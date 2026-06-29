import { prisma } from "@/lib/db";
import { EntityIds } from "@/lib/domain/entities";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { scanFundingOpportunity } from "@/lib/github/opportunities";
import { ingestRepository } from "@/lib/github/adapter";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { domainLabel, domainForConnector } from "@/lib/workspace/domains";
import { eventTypeLabel, explainRecognition } from "@/lib/workspace/events";
import { layoutGraphNodes } from "@/lib/discover/radar";
import {
  conservationFlow,
  giniCoefficient,
  hIndexStyle,
} from "@/lib/entity/economics";
import {
  ENTITY_KIND_LABELS,
  entityIdToPath,
  entitySurfaceKind,
  payeeToEntityId,
} from "@/lib/entity/paths";
import type {
  EntityEvidenceItem,
  EntityPayment,
  EntityPerson,
  EntityRelationship,
  EntitySurface,
  EntityTimelineItem,
} from "@/lib/entity/types";
import type { DiscoverGraphEdge, DiscoverGraphNode } from "@/lib/discover/radar";

type AuthRow = {
  id: string;
  connectorId: string;
  eventType: string;
  missionId: string;
  amountUsd: number;
  weight: number;
  status: string;
  contextLabel: string | null;
  payeeKey: string;
  payeeKeyType: string;
  confidence: number;
  evidenceJson: string | null;
  updatedAt: Date;
  createdAt: Date;
};

function parseRepoId(id: string): { owner: string; repo: string } | null {
  if (!id.startsWith("repo:")) return null;
  const slug = id.slice(5);
  const slash = slug.indexOf("/");
  if (slash === -1) return null;
  return { owner: slug.slice(0, slash), repo: slug.slice(slash + 1) };
}

function parsePersonGitHub(id: string): string | null {
  if (!id.startsWith("person:github:")) return null;
  return id.slice(14);
}

function parseCreator(id: string): string | null {
  if (!id.startsWith("creator:")) return null;
  return id.slice(8);
}

function parseCommunitySlug(id: string): string | null {
  if (!id.startsWith("community:")) return null;
  return id.slice(10);
}

async function fetchAuthRowsForEntity(entityId: string): Promise<AuthRow[]> {
  const repo = parseRepoId(entityId);
  const creator = parseCreator(entityId);
  const githubUser = parsePersonGitHub(entityId);
  const communitySlug = parseCommunitySlug(entityId);

  if (creator) {
    return prisma.paymentAuthorization
      .findMany({
        where: { payeeKeyType: "listen_artist", payeeKey: creator.toLowerCase() },
        orderBy: { updatedAt: "desc" },
        take: 200,
      })
      .catch(() => []);
  }

  if (githubUser) {
    return prisma.paymentAuthorization
      .findMany({
        where: { payeeKeyType: "github_username", payeeKey: githubUser.toLowerCase() },
        orderBy: { updatedAt: "desc" },
        take: 200,
      })
      .catch(() => []);
  }

  if (repo) {
    const fullName = `${repo.owner}/${repo.repo}`;
    return prisma.paymentAuthorization
      .findMany({
        where: {
          OR: [
            { contextLabel: { contains: fullName, mode: "insensitive" } },
            { contextLabel: { contains: repo.repo, mode: "insensitive" } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      })
      .catch(() => []);
  }

  if (communitySlug) {
    const community = getCommunityBySlug(communitySlug);
    if (!community?.connectors.length) return [];
    return prisma.paymentAuthorization
      .findMany({
        where: { connectorId: { in: community.connectors } },
        orderBy: { updatedAt: "desc" },
        take: 200,
      })
      .catch(() => []);
  }

  if (entityId.startsWith("work:")) {
    const needle = entityId.slice(5);
    return prisma.paymentAuthorization
      .findMany({
        where: {
          OR: [
            { contextLabel: { contains: needle, mode: "insensitive" } },
            { payeeKey: { contains: needle, mode: "insensitive" } },
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      })
      .catch(() => []);
  }

  return [];
}

function buildPayments(rows: AuthRow[]): EntityPayment[] {
  return rows.slice(0, 24).map((r) => ({
    id: r.id,
    amountUsd: r.amountUsd,
    status: r.status,
    contextLabel: r.contextLabel,
    connectorId: r.connectorId,
    at: r.updatedAt.toISOString(),
    evidence: explainRecognition({
      eventType: r.eventType,
      domain: domainLabel(r.connectorId),
      context: r.contextLabel ?? r.payeeKey,
      status: r.status,
      amountUsd: r.amountUsd,
      confidence: r.confidence,
    }),
  }));
}

function buildTimeline(rows: AuthRow[]): EntityTimelineItem[] {
  return rows.slice(0, 20).map((r) => ({
    id: `auth-${r.id}`,
    title: eventTypeLabel(r.eventType),
    detail: r.contextLabel ?? r.payeeKey,
    at: r.updatedAt.toISOString(),
    evidence: `${domainForConnector(r.connectorId)} · $${r.amountUsd.toFixed(4)} · ${r.status}`,
  }));
}

function buildEvidence(rows: AuthRow[]): EntityEvidenceItem[] {
  const items: EntityEvidenceItem[] = [];
  for (const r of rows.slice(0, 12)) {
    let refs: string[] = [];
    try {
      const parsed = JSON.parse(r.evidenceJson ?? "{}") as { evidenceRefs?: string[] };
      refs = parsed.evidenceRefs ?? [];
    } catch {
      refs = [];
    }
    items.push({
      id: r.id,
      label: r.contextLabel ?? r.payeeKey,
      detail: refs.length ? refs.join(", ") : `proof:${r.id.slice(0, 12)}`,
      source: `${domainLabel(r.connectorId)} · confidence ${(r.confidence * 100).toFixed(0)}%`,
    });
  }
  return items;
}

function buildLocalGraph(
  entityId: string,
  rows: AuthRow[],
  extraNodes: DiscoverGraphNode[] = [],
  extraEdges: DiscoverGraphEdge[] = [],
): { nodes: DiscoverGraphNode[]; edges: DiscoverGraphEdge[] } {
  const nodeMap = new Map<string, DiscoverGraphNode>();
  const edges: DiscoverGraphEdge[] = [];

  function addNode(id: string, label: string, type: string, weight = 1) {
    const existing = nodeMap.get(id);
    if (existing) {
      existing.weight += weight;
      return;
    }
    nodeMap.set(id, { id, label, type, weight });
  }

  function addEdge(from: string, to: string, kind: string, weight: number, evidence: string) {
    const id = `${from}->${to}:${kind}`;
    if (edges.some((e) => e.id === id)) return;
    edges.push({ id, from, to, kind, weight, evidence });
  }

  const kind = entitySurfaceKind(entityId);
  const centerType =
    kind === "repository"
      ? "repository"
      : kind === "artist"
        ? "creator"
        : kind === "maintainer"
          ? "person"
          : kind === "work"
            ? "work"
            : "community";

  addNode(entityId, entityId, centerType, 1);

  for (const n of extraNodes) addNode(n.id, n.label, n.type, n.weight);
  edges.push(...extraEdges);

  for (const r of rows) {
    const payeeId = payeeToEntityId(r.payeeKey, r.payeeKeyType);
    const missionId = `mission:${r.missionId}`;
    const connectorId = `connector:${r.connectorId}`;

    addNode(payeeId, r.payeeKey, "creator", r.amountUsd);
    addNode(missionId, `Mission ${r.missionId.slice(0, 12)}…`, "mission", 1);
    addNode(connectorId, domainLabel(r.connectorId), "connector", 1);

    addEdge(connectorId, payeeId, "observed", r.amountUsd, r.contextLabel ?? r.payeeKey);
    addEdge(payeeId, missionId, "authorized", r.amountUsd, r.status);
    addEdge(entityId, payeeId, "related", r.amountUsd, r.contextLabel ?? "");
  }

  const nodes = layoutGraphNodes([...nodeMap.values()].slice(0, 32));
  const nodeIds = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: edges.filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to)),
  };
}

export async function buildEntitySurface(entityId: string): Promise<EntitySurface | null> {
  const kind = entitySurfaceKind(entityId);
  const path = entityIdToPath(entityId) ?? `/e/raw/${encodeURIComponent(entityId)}`;
  const typeLabel = ENTITY_KIND_LABELS[kind];

  let label = entityId;
  let subtitle = typeLabel;
  const attributes: Record<string, string | number> = {};
  let fundingGapUsd = 0;
  let fundingHeadline = "No funding gap signal yet";
  let fundingEvidence = "Funding gap appears when GitHub health or program budgets expose unfunded work.";
  const relationships: EntityRelationship[] = [];
  const people: EntityPerson[] = [];
  const extraNodes: DiscoverGraphNode[] = [];
  const extraEdges: DiscoverGraphEdge[] = [];

  const repo = parseRepoId(entityId);
  const creator = parseCreator(entityId);
  const githubUser = parsePersonGitHub(entityId);
  const communitySlug = parseCommunitySlug(entityId);

  if (repo) {
    label = `${repo.owner}/${repo.repo}`;
    subtitle = "Open source repository";
    const opp = await scanFundingOpportunity(repo.owner, repo.repo).catch(() => null);
    if (opp) {
      fundingGapUsd = opp.health.fundingGapUsd;
      fundingHeadline = opp.headline;
      fundingEvidence = `GitHub sensor · ${opp.priority} priority · ${opp.stars} stars · gap est. $${fundingGapUsd.toLocaleString()}`;
      attributes.stars = opp.stars;
      attributes.forks = opp.forks;
      attributes.maintainers = opp.health.maintainerCount;

      const ingest = await ingestRepository(repo.owner, repo.repo, { prLimit: 6 }).catch(() => null);
      if (ingest) {
        for (const c of ingest.contributors.slice(0, 8)) {
          const pid = EntityIds.personGitHub(c.login);
          people.push({
            id: pid,
            label: c.login,
            role: "Contributor",
            path: entityIdToPath(pid) ?? `/e/maintainer/github/${c.login}`,
            evidence: `${c.followers ?? 0} followers · GitHub REST`,
          });
          relationships.push({
            id: `contrib-${c.login}`,
            type: "contributed_to",
            targetId: pid,
            targetLabel: c.login,
            targetPath: entityIdToPath(pid) ?? `/e/maintainer/github/${c.login}`,
            weight: c.followers ?? 1,
            evidence: `Contributor profile · ${ingest.fullName}`,
          });
        }
      }

      const maintId = EntityIds.personGitHub(`${repo.owner}-core`);
      extraNodes.push({
        id: maintId,
        label: `${repo.repo} maintainers`,
        type: "person",
        weight: opp.health.maintainerCount,
      });
      extraEdges.push({
        id: `${entityId}->${maintId}:maintained_by`,
        from: entityId,
        to: maintId,
        kind: "maintained_by",
        weight: opp.health.maintainerCount,
        evidence: opp.headline,
      });
    }
  } else if (creator) {
    label = creator;
    subtitle = "Music creator · listen sensor";
    attributes.payeeType = "listen_artist";
  } else if (githubUser) {
    label = githubUser;
    subtitle = "GitHub maintainer";
    attributes.platform = "github";
  } else if (communitySlug) {
    const community = getCommunityBySlug(communitySlug);
    if (!community) return null;
    label = community.name;
    subtitle = community.tagline;
    attributes.kind = community.kind;
    attributes.upstream = community.upstream;
    for (const conn of community.connectors) {
      relationships.push({
        id: `conn-${conn}`,
        type: "uses_sensor",
        targetId: `connector:${conn}`,
        targetLabel: domainLabel(conn),
        targetPath: "/profile",
        weight: 1,
        evidence: community.doctrine.slice(0, 100),
      });
    }
  } else if (entityId.startsWith("work:")) {
    const workKey = entityId.slice(5);
    label = workKey.replace(/:/g, " · ");
    subtitle = "Creative or research work";
    attributes.canonicalId = entityId;
  } else {
    return null;
  }

  const [authRows, treasury] = await Promise.all([
    fetchAuthRowsForEntity(entityId).catch(() => [] as AuthRow[]),
    getTreasurySnapshot().catch(() => null),
  ]);

  const settledUsd = authRows
    .filter((r) => r.status === "settled")
    .reduce((s, r) => s + r.amountUsd, 0);
  const pendingUsd = authRows
    .filter((r) => ["authorized", "pending_funding", "claimable", "claimed"].includes(r.status))
    .reduce((s, r) => s + r.amountUsd, 0);
  const inflowsUsd = settledUsd + pendingUsd;
  const treasuryUsd = treasury?.balanceUsd ?? 0;

  const valueTotal = authRows.reduce((s, r) => s + r.amountUsd, 0);
  const payeeAmounts = authRows.map((r) => r.amountUsd);
  const workWeights = entityId.startsWith("work:")
    ? authRows.map((r) => Math.max(1, Math.round(r.weight || r.amountUsd * 100)))
    : [];

  const graph = buildLocalGraph(entityId, authRows, extraNodes, extraEdges);
  const payments = buildPayments(authRows);
  const timeline = buildTimeline(authRows);
  const evidence = buildEvidence(authRows);

  const live = authRows.length > 0 || fundingGapUsd > 0 || people.length > 0;
  const emptyReason = live
    ? null
    : "No ledger rows or sensor signals for this entity yet. Install a community and connect sensors to populate this page.";

  return {
    ok: true,
    id: entityId,
    kind,
    label,
    subtitle,
    path,
    live,
    emptyReason,
    overview: {
      typeLabel,
      sourceConnector: authRows[0]?.connectorId,
      attributes,
    },
    valueCreated: {
      totalUsd: Math.round(valueTotal * 100) / 100,
      eventCount: authRows.length,
      evidence:
        authRows.length > 0
          ? `$${valueTotal.toFixed(2)} recognized across ${authRows.length} authorization rows`
          : "No recognized value in ledger for this entity",
    },
    fundingGap: {
      gapUsd: fundingGapUsd,
      headline: fundingHeadline,
      evidence: fundingEvidence,
    },
    relationships,
    people,
    timeline,
    payments,
    evidence,
    economics: {
      conservation: conservationFlow({
        inflowsUsd,
        treasuryUsd,
        settledUsd,
        pendingUsd,
      }),
      gini: giniCoefficient(payeeAmounts.length ? payeeAmounts : authRows.map((r) => r.amountUsd)),
      hIndex:
        entityId.startsWith("work:") || kind === "maintainer"
          ? hIndexStyle(workWeights.length ? workWeights : payeeAmounts)
          : null,
    },
    graph,
    communitySlug: communitySlug ?? null,
    updatedAt: new Date().toISOString(),
  };
}
