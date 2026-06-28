import { prisma } from "@/lib/db";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import { domainLabel, domainForConnector } from "@/lib/workspace/domains";
import { eventTypeLabel, explainRecognition } from "@/lib/workspace/events";
import { EntityIds } from "@/lib/domain/entities";
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
  at: string;
  evidence: string;
};

export type DiscoverGraphNode = {
  id: string;
  label: string;
  type: string;
  x?: number;
  y?: number;
  weight: number;
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
  live: boolean;
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
const MAX_GRAPH_NODES = 48;

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
    activity.push({
      id: `auth-${r.id}`,
      kind: "authorization",
      title: eventTypeLabel(r.eventType),
      detail: context,
      amountUsd: r.amountUsd,
      status: r.status,
      connectorId: r.connectorId,
      domain,
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

  function addNode(id: string, label: string, type: string, weight = 1) {
    const existing = nodeMap.get(id);
    if (existing) {
      existing.weight += weight;
      return;
    }
    nodeMap.set(id, { id, label, type, weight });
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

    addNode(payeeId, r.payeeKey, "creator", r.amountUsd);
    addNode(missionId, r.missionId ? `Mission ${r.missionId.slice(0, 12)}…` : "Unscoped", "mission", 1);
    addNode(connectorId, domainLabel(r.connectorId), "connector", 1);

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
    addNode(repoId, opp.fullName, "repository", opp.health.fundingGapUsd);
    const maintId = EntityIds.personGitHub(`${opp.owner}-core`);
    addNode(maintId, `${opp.repo} maintainers`, "person", opp.health.maintainerCount);
    addEdge(repoId, maintId, "maintained_by", opp.health.maintainerCount, opp.headline);
    if (opp.health.fundingGapUsd > 0) {
      addNode("pool:treasury", "Treasury gap", "treasury", opp.health.fundingGapUsd);
      addEdge(
        repoId,
        "pool:treasury",
        "funding_gap",
        opp.health.fundingGapUsd,
        `Est. gap $${opp.health.fundingGapUsd.toLocaleString()} · ${opp.priority} priority`,
      );
    }
  }

  for (const c of COMMUNITY_CATALOG.filter((x) => x.featured)) {
    const commId = EntityIds.community(c.slug);
    addNode(commId, c.name, "community", 1);
    for (const conn of c.connectors) {
      const connId = `connector:${conn}`;
      addNode(connId, domainLabel(conn), "connector", 1);
      addEdge(commId, connId, "uses_sensor", 1, c.doctrine.slice(0, 80));
    }
  }

  const sortedNodes = [...nodeMap.values()]
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

  const live = trimmedActivity.length > 0 || laidOut.length > 0;
  const emptyReason =
    live
      ? null
      : "No live authorization events yet. Install a community, connect Navidrome or GitHub, and value will appear here automatically.";

  return {
    ok: true,
    live,
    activity: trimmedActivity,
    graph: { nodes: laidOut, edges: filteredEdges },
    metrics: { topNodes, fundingEntropy: entropy },
    emptyReason,
    updatedAt: new Date().toISOString(),
  };
}
