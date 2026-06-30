import { prisma } from "@/lib/db";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import { resolveCommunityForRepo } from "@/lib/discover/repo-community";
import { domainLabel, domainForConnector } from "@/lib/workspace/domains";
import { eventTypeLabel, explainRecognition } from "@/lib/workspace/events";
import { EntityIds } from "@/lib/domain/entities";
import { entityIdToPath, payeeToEntityId } from "@/lib/entity/paths";
import {
  dataSourceForNodeType,
  defaultActionsForGraphNode,
} from "@/lib/discover/graph-node-actions";
import { graphDomainForConnector } from "@/lib/discover/graph-domain";
import type { DiscoverAction, DiscoverDataSource } from "@/lib/discover/types";

import {
  fundingEntropy,
  rankGraphNodes,
  type MetricEdge,
} from "@/lib/graph/metrics";

export type DiscoverActivityItem = {
  id: string;
  kind: "authorization" | "timeline";
  title: string;
  detail: string;
  amountUsd?: number;
  status?: string;
  connectorId?: string;
  domain?: string;
  entityId?: string;
  entityPath?: string;
  at: string;
  evidence: string;
};

export type DiscoverGraphNode = {
  id: string;
  label: string;
  type: string;
  entityPath?: string;
  x?: number;
  y?: number;
  weight: number;
  dataSource?: DiscoverDataSource;
  amountVerified?: boolean;
  moneyGapUsd?: number | null;
  whyItMatters?: string;
  updatedAt?: string;
  proofHref?: string;
  communitySlug?: string;
  programId?: string;
  templateId?: string;
  missionId?: string;
  actions?: DiscoverAction[];
  /** OSS / music / research tint for bubblemap filters */
  graphDomain?: "oss" | "music" | "research" | "other";
  synthetic?: boolean;
  pendingFunding?: boolean;
  authorizationStatus?: string;
};

export type DiscoverGraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: string;
  weight: number;
  evidence: string;
};

export type DiscoverRadarPayload = {
  ok: true;
  /** True when ledger authorization rows exist (real observed value). */
  live: boolean;
  /** Graph includes catalog/GitHub scan nodes without ledger events. */
  hasCatalogPreview: boolean;
  ledgerEventCount: number;
  activity: DiscoverActivityItem[];
  graph: {
    nodes: DiscoverGraphNode[];
    edges: DiscoverGraphEdge[];
  };
  metrics: {
    topNodes: ReturnType<typeof rankGraphNodes>;
    fundingEntropy: ReturnType<typeof fundingEntropy>;
  };
  emptyReason: string | null;
  updatedAt: string;
};

const MAX_ACTIVITY = 24;
const MAX_GRAPH_NODES = 24;

function payeeNodeId(payeeKey: string, payeeKeyType: string) {
  if (payeeKeyType === "listen_artist") return `creator:${payeeKey.toLowerCase()}`;
  if (payeeKeyType === "github_user") return EntityIds.personGitHub(payeeKey);
  return `payee:${payeeKeyType}:${payeeKey.toLowerCase()}`;
}

/** Simple radial layout — deterministic, no fake physics */
export function layoutGraphNodes(nodes: DiscoverGraphNode[]): DiscoverGraphNode[] {
  const n = nodes.length;
  if (n === 0) return nodes;
  const cx = 200;
  const cy = 140;
  const radius = Math.min(110, 40 + n * 4);

  return nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return {
      ...node,
      x: Math.round(cx + radius * Math.cos(angle)),
      y: Math.round(cy + radius * Math.sin(angle)),
    };
  });
}

export async function buildDiscoverRadar(): Promise<DiscoverRadarPayload> {
  const skipGithubScan = process.env.CI === "true";

  const [authRows, timelineRows, opportunities] = await Promise.all([
    prisma.paymentAuthorization
      .findMany({
        orderBy: { updatedAt: "desc" },
        take: MAX_ACTIVITY,
        select: {
          id: true,
          connectorId: true,
          eventType: true,
          amountUsd: true,
          status: true,
          contextLabel: true,
          payeeKey: true,
          payeeKeyType: true,
          confidence: true,
          missionId: true,
          updatedAt: true,
        },
      })
      .catch(() => []),
    prisma.resolveTimelineEvent
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          eventType: true,
          title: true,
          detail: true,
          severity: true,
          createdAt: true,
        },
      })
      .catch(() => []),
    skipGithubScan ? Promise.resolve([]) : scanAllOpportunities().catch(() => []),
  ]);

  const activity: DiscoverActivityItem[] = [];

  for (const r of authRows) {
    const domain = domainLabel(r.connectorId);
    const context = r.contextLabel ?? r.payeeKey;
    const entityId = payeeToEntityId(r.payeeKey, r.payeeKeyType);
    activity.push({
      id: `auth-${r.id}`,
      kind: "authorization",
      title: eventTypeLabel(r.eventType),
      detail: context,
      amountUsd: r.amountUsd,
      status: r.status,
      connectorId: r.connectorId,
      domain,
      entityId,
      entityPath: entityIdToPath(entityId) ?? undefined,
      at: r.updatedAt.toISOString(),
      evidence: explainRecognition({
        eventType: r.eventType,
        domain,
        context,
        status: r.status,
        amountUsd: r.amountUsd,
        confidence: r.confidence,
      }),
    });
  }

  for (const t of timelineRows) {
    activity.push({
      id: `tl-${t.id}`,
      kind: "timeline",
      title: t.title,
      detail: t.detail ?? t.eventType,
      at: t.createdAt.toISOString(),
      evidence: `Community event · ${t.eventType}${t.severity !== "info" ? ` · ${t.severity}` : ""}`,
    });
  }

  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const trimmedActivity = activity.slice(0, MAX_ACTIVITY);

  const nodeMap = new Map<string, DiscoverGraphNode>();
  const edgeList: DiscoverGraphEdge[] = [];
  const metricEdges: MetricEdge[] = [];
  const labels = new Map<string, string>();
  const payeeAmounts: number[] = [];

  function addNode(
    id: string,
    label: string,
    type: string,
    weight = 1,
    meta?: Partial<DiscoverGraphNode>,
  ) {
    const existing = nodeMap.get(id);
    const entityPath = meta?.entityPath ?? entityIdToPath(id) ?? undefined;
    if (existing) {
      existing.weight += weight;
      if (meta?.moneyGapUsd != null) existing.moneyGapUsd = meta.moneyGapUsd;
      if (meta?.updatedAt) existing.updatedAt = meta.updatedAt;
      if (meta?.pendingFunding) existing.pendingFunding = true;
      if (meta?.graphDomain) existing.graphDomain = meta.graphDomain;
      if (meta?.authorizationStatus) existing.authorizationStatus = meta.authorizationStatus;
      if (meta?.synthetic) existing.synthetic = meta.synthetic;
      return;
    }
    nodeMap.set(id, {
      id,
      label,
      type,
      weight,
      entityPath,
      dataSource: meta?.dataSource ?? dataSourceForNodeType(type),
      amountVerified: meta?.amountVerified ?? false,
      moneyGapUsd: meta?.moneyGapUsd ?? null,
      whyItMatters: meta?.whyItMatters,
      updatedAt: meta?.updatedAt,
      proofHref: meta?.proofHref,
      communitySlug: meta?.communitySlug,
      programId: meta?.programId,
      templateId: meta?.templateId,
      missionId: meta?.missionId,
      synthetic: meta?.synthetic,
    });
    labels.set(id, label);
  }

  function addEdge(from: string, to: string, kind: string, weight: number, evidence: string) {
    const id = `${from}->${to}:${kind}`;
    if (edgeList.some((e) => e.id === id)) return;
    edgeList.push({ id, from, to, kind, weight, evidence });
    metricEdges.push({ from, to, weight });
  }

  for (const r of authRows) {
    const payeeId = payeeNodeId(r.payeeKey, r.payeeKeyType);
    const missionId = r.missionId ? `mission:${r.missionId}` : "mission:unscoped";
    const connectorId = `connector:${r.connectorId}`;
    const entityPath = entityIdToPath(payeeToEntityId(r.payeeKey, r.payeeKeyType)) ?? undefined;

    const payeeDomain = graphDomainForConnector(r.connectorId);
    const nodeType =
      r.payeeKeyType === "listen_artist" ? "creator"
      : r.payeeKeyType === "github_username" ? "person"
      : "creator";

    addNode(payeeId, r.payeeKey, nodeType, r.amountUsd, {
      dataSource: "supabase_ledger",
      amountVerified: true,
      moneyGapUsd: r.amountUsd,
      whyItMatters: `Authorization from ${domainLabel(r.connectorId)} sensor — ${r.status}`,
      updatedAt: r.updatedAt.toISOString(),
      proofHref: `/receipt/${r.id}`,
      entityPath,
      missionId: r.missionId ?? undefined,
      graphDomain: payeeDomain,
      pendingFunding: r.status === "pending_funding",
      authorizationStatus: r.status,
    });
    addNode(missionId, r.missionId ? `Mission ${r.missionId.slice(0, 12)}…` : "Unscoped", "mission", 1, {
      dataSource: "supabase_ledger",
      amountVerified: true,
      missionId: r.missionId ?? undefined,
      whyItMatters: "Mission scope for authorized payments",
      updatedAt: r.updatedAt.toISOString(),
    });
    const connDomain = graphDomainForConnector(r.connectorId);
    addNode(connectorId, domainLabel(r.connectorId), "connector", 1, {
      dataSource: "local_seed",
      amountVerified: false,
      whyItMatters: `${domainForConnector(r.connectorId)} connector observing value`,
      graphDomain: connDomain,
    });

    addEdge(
      connectorId,
      payeeId,
      "observed",
      r.amountUsd,
      `${domainForConnector(r.connectorId)} sensor · ${r.contextLabel ?? r.payeeKey}`,
    );
    addEdge(
      payeeId,
      missionId,
      "authorized",
      r.amountUsd,
      `$${r.amountUsd.toFixed(4)} · ${r.status}`,
    );

    payeeAmounts.push(r.amountUsd);
  }

  for (const opp of opportunities.slice(0, 6)) {
    const repoId = EntityIds.repository(opp.owner, opp.repo);
    const repoPath = entityIdToPath(repoId) ?? undefined;
    const { communitySlug, templateId } = resolveCommunityForRepo(opp.owner, opp.repo);
    addNode(repoId, opp.fullName, "repository", opp.health.fundingGapUsd, {
      dataSource: "github",
      amountVerified: false,
      moneyGapUsd: opp.health.fundingGapUsd,
      whyItMatters: `${opp.headline} · est. gap from repo health`,
      entityPath: repoPath,
      graphDomain: "oss",
      communitySlug,
      templateId,
    });
    if (opp.health.fundingGapUsd > 0) {
      addNode("pool:treasury", "Treasury gap", "treasury", opp.health.fundingGapUsd, {
        dataSource: "github",
        amountVerified: false,
        synthetic: true,
        whyItMatters: "Estimated funding gap — fund via community program",
        communitySlug,
        templateId,
      });
      addEdge(
        repoId,
        "pool:treasury",
        "funding_gap",
        opp.health.fundingGapUsd,
        `Est. gap $${opp.health.fundingGapUsd.toLocaleString()} · ${opp.priority} priority`,
      );
    }
  }

  const sortedNodes = [...nodeMap.values()]
    .map((n) => ({
      ...n,
      actions:
        n.actions ??
        defaultActionsForGraphNode({
          type: n.type,
          entityPath: n.entityPath,
          communitySlug: n.communitySlug,
          programId: n.programId,
          templateId: n.templateId,
          missionId: n.missionId,
          receiptId: n.proofHref?.match(/\/receipt\/([^/?#]+)/)?.[1],
          synthetic: n.synthetic,
        }),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_GRAPH_NODES);

  const nodeIdSet = new Set(sortedNodes.map((n) => n.id));
  const filteredEdges = edgeList.filter((e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to));
  const filteredMetricEdges = metricEdges.filter(
    (e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to),
  );

  const laidOut = layoutGraphNodes(sortedNodes);
  const topNodes = rankGraphNodes({
    nodeIds: laidOut.map((n) => n.id),
    labels,
    edges: filteredMetricEdges,
    topN: 6,
  });

  const entropy = fundingEntropy(payeeAmounts);

  const ledgerEventCount = authRows.length;
  const live = ledgerEventCount > 0;
  const hasCatalogPreview = laidOut.length > ledgerEventCount && !live;
  const emptyReason =
    live
      ? null
      : "No live authorization events yet. Install a community, connect Navidrome or GitHub, and value will appear here automatically.";

  return {
    ok: true,
    live,
    hasCatalogPreview,
    ledgerEventCount,
    activity: trimmedActivity,
    graph: { nodes: laidOut, edges: filteredEdges },
    metrics: { topNodes, fundingEntropy: entropy },
    emptyReason,
    updatedAt: new Date().toISOString(),
  };
}
