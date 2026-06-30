import type { DiscoverGraphEdge, DiscoverGraphNode } from "@/lib/discover/radar";
import { formatDiscoverMoney } from "@/lib/discover/money-display";
import { templateLabel } from "@/lib/capital/community-yield";

export type BubbleOperatorMetrics = {
  topNodes: Array<{
    id: string;
    label: string;
    degreeCentrality: number;
    betweenness: number;
    pageRank: number;
    evidence: string;
  }>;
  fundingEntropy: {
    entropy: number;
    maxEntropy: number;
    concentrationPct: number;
    evidence: string;
  };
};

export type BubbleOperatorSection = {
  id: "needs" | "programs" | "money" | "people" | "open_work";
  title: string;
  items: Array<{ label: string; detail: string; tone?: "warn" | "ok" | "muted" }>;
};

export type BubbleOperatorSurface = {
  node: DiscoverGraphNode;
  stats: {
    weight: string;
    moneyLabel: string;
    moneyTone: "verified" | "estimate" | "muted";
    statusLabel: string;
    sourceLabel: string;
  };
  sections: BubbleOperatorSection[];
  nodeMetrics: BubbleOperatorMetrics["topNodes"][number] | null;
  observatoryHref: string | null;
};

function neighborNodes(
  nodeId: string,
  nodes: DiscoverGraphNode[],
  edges: DiscoverGraphEdge[],
): DiscoverGraphNode[] {
  const ids = new Set<string>();
  for (const e of edges) {
    if (e.from === nodeId) ids.add(e.to);
    if (e.to === nodeId) ids.add(e.from);
  }
  return nodes.filter((n) => ids.has(n.id));
}

function moneyEdges(nodeId: string, edges: DiscoverGraphEdge[]): DiscoverGraphEdge[] {
  return edges.filter(
    (e) =>
      (e.from === nodeId || e.to === nodeId) &&
      (e.kind === "authorized" || e.kind === "observed" || e.kind === "funding_gap"),
  );
}

export function buildBubbleOperatorSurface(input: {
  node: DiscoverGraphNode;
  nodes: DiscoverGraphNode[];
  edges: DiscoverGraphEdge[];
  metrics?: BubbleOperatorMetrics | null;
}): BubbleOperatorSurface {
  const { node, nodes, edges, metrics } = input;
  const money = formatDiscoverMoney(node.moneyGapUsd, node.amountVerified ?? false, node.dataSource);
  const neighbors = neighborNodes(node.id, nodes, edges);
  const flows = moneyEdges(node.id, edges).sort((a, b) => b.weight - a.weight);

  const sections: BubbleOperatorSection[] = [];

  const needItems: BubbleOperatorSection["items"] = [];
  if (node.whyItMatters) {
    needItems.push({ label: "Signal", detail: node.whyItMatters });
  }
  if ((node.moneyGapUsd ?? 0) > 0) {
    needItems.push({
      label: "Funding need",
      detail: money.label,
      tone: node.amountVerified ? "warn" : "muted",
    });
  }
  if (node.pendingFunding) {
    needItems.push({
      label: "Queue",
      detail: "Authorizations pending fulfillment — fund to clear",
      tone: "warn",
    });
  }
  if (node.authorizationStatus && node.authorizationStatus !== "settled") {
    needItems.push({
      label: "Authorization",
      detail: `Status: ${node.authorizationStatus.replace(/_/g, " ")}`,
      tone: "muted",
    });
  }
  if (!needItems.length) {
    needItems.push({
      label: "Needs",
      detail: node.synthetic
        ? "Connect a sensor to surface verified needs from this ecosystem"
        : "No open funding need on this node yet",
      tone: "muted",
    });
  }
  sections.push({ id: "needs", title: "Needs", items: needItems });

  const programItems: BubbleOperatorSection["items"] = [];
  if (node.templateId) {
    programItems.push({
      label: templateLabel(node.templateId),
      detail: node.programId ? `Program ${node.programId.slice(0, 8)}…` : "Template ready to deploy",
    });
  }
  if (node.communitySlug) {
    programItems.push({
      label: "Community",
      detail: node.communitySlug,
      tone: "ok",
    });
  }
  if (node.missionId) {
    programItems.push({
      label: "Mission scope",
      detail: node.missionId.slice(0, 12) + "…",
    });
  }
  if (!programItems.length) {
    programItems.push({
      label: "Programs",
      detail: "Start a bounty or install a community program to attach capital",
      tone: "muted",
    });
  }
  sections.push({ id: "programs", title: "Programs", items: programItems });

  const moneyItems: BubbleOperatorSection["items"] = flows.slice(0, 5).map((e) => ({
    label: e.kind.replace(/_/g, " "),
    detail: `${e.evidence} · weight ${e.weight.toFixed(2)}`,
    tone: e.kind === "funding_gap" ? ("warn" as const) : ("muted" as const),
  }));
  if (!moneyItems.length) {
    moneyItems.push({
      label: "Money flowing",
      detail:
        node.amountVerified && (node.moneyGapUsd ?? 0) > 0
          ? `$${(node.moneyGapUsd ?? 0).toFixed(2)} verified on ledger`
          : "No ledger flows yet — flows appear after sensor authorizations",
      tone: "muted",
    });
  }
  sections.push({ id: "money", title: "Money flowing", items: moneyItems });

  const people = neighbors.filter((n) => n.type === "person" || n.type === "creator");
  const peopleItems: BubbleOperatorSection["items"] = people.slice(0, 6).map((p) => ({
    label: p.label,
    detail: `${p.type}${p.authorizationStatus ? ` · ${p.authorizationStatus}` : ""}`,
    tone: p.pendingFunding ? "warn" : "muted",
  }));
  if (!peopleItems.length) {
    peopleItems.push({
      label: "People",
      detail: "Maintainers, artists, and contributors appear when sensors attribute value",
      tone: "muted",
    });
  }
  sections.push({ id: "people", title: "People", items: peopleItems });

  const openItems: BubbleOperatorSection["items"] = [];
  const gapNeighbors = neighbors.filter((n) => (n.moneyGapUsd ?? 0) > 0 || n.pendingFunding);
  for (const n of gapNeighbors.slice(0, 4)) {
    openItems.push({
      label: n.label,
      detail: n.pendingFunding ? "Pending funding" : `Gap ${formatDiscoverMoney(n.moneyGapUsd, n.amountVerified ?? false, n.dataSource).label}`,
      tone: "warn",
    });
  }
  for (const e of edges.filter((x) => x.kind === "funding_gap" && (x.from === node.id || x.to === node.id))) {
    openItems.push({ label: "Funding gap edge", detail: e.evidence, tone: "warn" });
  }
  if (!openItems.length) {
    openItems.push({
      label: "Open work",
      detail: node.synthetic
        ? "Install community + connect GitHub, Jellyfin, or ListenBrainz to open work items"
        : "No open work items linked to this node",
      tone: "muted",
    });
  }
  sections.push({ id: "open_work", title: "Open work", items: openItems });

  const nodeMetrics = metrics?.topNodes.find((t) => t.id === node.id) ?? null;
  const observatoryHref = node.communitySlug
    ? `/communities/${node.communitySlug}#observatory`
    : null;

  return {
    node,
    stats: {
      weight: node.weight.toFixed(2),
      moneyLabel: money.label,
      moneyTone:
        money.tone === "verified" ? "verified"
        : money.tone === "estimate" ? "estimate"
        : "muted",
      statusLabel: node.synthetic
        ? "Preview"
        : node.amountVerified
          ? "Ledger verified"
          : "Awaiting sensor",
      sourceLabel: (node.dataSource ?? "unknown").replace(/_/g, " "),
    },
    sections,
    nodeMetrics,
    observatoryHref,
  };
}
