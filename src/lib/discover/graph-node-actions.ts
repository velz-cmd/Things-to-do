import type { DiscoverGraphEdge, DiscoverGraphNode } from "./radar";
import { hasFundingGapEdge } from "./graph-domain";
import type { DiscoverAction, DiscoverDataSource, DiscoverIntent } from "./types";

export function bubblePopoverActions(
  node: DiscoverGraphNode,
  edges: DiscoverGraphEdge[],
): DiscoverAction[] {
  const actions: DiscoverAction[] = [];

  if (node.entityPath && !node.synthetic) {
    actions.push({ id: "open", label: "Open", kind: "open", entityPath: node.entityPath });
  }

  const gapEdge = hasFundingGapEdge(node.id, edges);
  const canFund =
    (gapEdge || ((node.moneyGapUsd ?? 0) > 0 && (node.type === "repository" || node.type === "ecosystem"))) &&
    !node.synthetic &&
    Boolean(node.programId || node.communitySlug);

  if (canFund) {
    actions.push({
      id: "fund",
      label: gapEdge ? "Fund gap" : "Fund",
      kind: "fund",
      programId: node.programId,
      communitySlug: node.communitySlug,
      templateId: node.templateId,
      missionId: node.missionId,
      amountUsd:
        node.moneyGapUsd != null && node.moneyGapUsd > 0
          ? Math.max(5, Math.min(node.moneyGapUsd, 500))
          : undefined,
    });
  }

  if (node.type === "community" && node.communitySlug && !node.synthetic) {
    actions.push({
      id: "install",
      label: "Install",
      kind: "install",
      communitySlug: node.communitySlug,
    });
  }

  if (node.synthetic && node.communitySlug) {
    actions.push({
      id: "install",
      label: "Install community",
      kind: "install",
      communitySlug: node.communitySlug,
    });
  }

  return actions;
}

export function defaultActionsForGraphNode(input: {
  type: string;
  entityPath?: string;
  communitySlug?: string;
  programId?: string;
  templateId?: string;
  missionId?: string;
  receiptId?: string;
  synthetic?: boolean;
}): DiscoverAction[] {
  const actions: DiscoverAction[] = [];

  if (input.entityPath && !input.synthetic) {
    actions.push({ id: "open", label: "Open", kind: "open", entityPath: input.entityPath });
    actions.push({
      id: "analyze",
      label: "Analyze",
      kind: "analyze",
      entityPath: input.entityPath,
    });
  }

  if ((input.programId || input.communitySlug || input.missionId) && !input.synthetic) {
    actions.push({
      id: "fund",
      label: "Fund",
      kind: "fund",
      programId: input.programId,
      communitySlug: input.communitySlug,
      templateId: input.templateId,
      missionId: input.missionId,
    });
    actions.push({
      id: "install",
      label: "Install",
      kind: "install",
      communitySlug: input.communitySlug,
    });
  }

  if (input.receiptId) {
    actions.push({
      id: "share",
      label: "Share receipt",
      kind: "share",
      href: `/receipt/${input.receiptId}`,
    });
  }

  return actions;
}

export function dataSourceForNodeType(type: string): DiscoverDataSource {
  if (type === "repository" || type === "ecosystem" || type === "person") return "github";
  if (type === "creator") return "musicbrainz";
  if (type === "community") return "catalog_preview";
  return "supabase_ledger";
}

export function filterGraphByIntent(
  nodes: DiscoverGraphNode[],
  edges: DiscoverGraphEdge[],
  intent: DiscoverIntent,
): { nodes: DiscoverGraphNode[]; edges: DiscoverGraphEdge[] } {
  if (intent === "all") return { nodes, edges };

  const ids = new Set<string>();

  for (const node of nodes) {
    if (intent === "fund" || intent === "sponsor") {
      if (
        hasFundingGapEdge(node.id, edges) ||
        (node.moneyGapUsd ?? 0) > 0 ||
        node.type === "treasury" ||
        node.programId
      ) {
        ids.add(node.id);
      }
    } else if (intent === "earn") {
      if (
        node.type === "creator" ||
        node.authorizationStatus === "claimable" ||
        (node.amountVerified && node.type === "person")
      ) {
        ids.add(node.id);
      }
    } else if (intent === "operate") {
      if (node.type === "community" || node.type === "connector" || node.communitySlug) {
        ids.add(node.id);
      }
    } else if (intent === "build") {
      if (
        node.type === "repository" ||
        node.type === "ecosystem" ||
        node.type === "community" ||
        node.type === "mission" ||
        node.entityPath
      ) {
        ids.add(node.id);
      }
    }
  }

  if (!ids.size) return { nodes: [], edges: [] };

  return {
    nodes: nodes.filter((n) => ids.has(n.id)),
    edges: edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
  };
}
