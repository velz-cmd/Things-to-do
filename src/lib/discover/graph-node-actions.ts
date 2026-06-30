import type { DiscoverAction, DiscoverDataSource } from "@/lib/discover/types";
import type { DiscoverGraphEdge, DiscoverGraphNode } from "@/lib/discover/radar";
import { hasFundingGapEdge } from "./graph-domain";

export function bubblePopoverActions(
  node: DiscoverGraphNode,
  edges: DiscoverGraphEdge[],
): DiscoverAction[] {
  const actions: DiscoverAction[] = [];

  if (node.entityPath) {
    actions.push({ id: "open", label: "Open", kind: "open", entityPath: node.entityPath });
  }

  const gapEdge = hasFundingGapEdge(node.id, edges);
  const canFund =
    gapEdge ||
    ((node.moneyGapUsd ?? 0) > 0 &&
      (node.type === "repository" || node.type === "treasury" || node.type === "person"));

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

  if (node.type === "community" && node.communitySlug) {
    actions.push({
      id: "install",
      label: "Install",
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
}): DiscoverAction[] {
  const actions: DiscoverAction[] = [];

  if (input.entityPath) {
    actions.push({ id: "open", label: "Open", kind: "open", entityPath: input.entityPath });
    actions.push({
      id: "analyze",
      label: "Analyze",
      kind: "analyze",
      entityPath: input.entityPath,
    });
  }

  if (input.programId || input.communitySlug || input.missionId) {
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
      id: "sponsor",
      label: "Sponsor",
      kind: "sponsor",
      programId: input.programId,
      communitySlug: input.communitySlug,
      templateId: input.templateId,
      missionId: input.missionId,
    });
  }

  if (input.communitySlug && !input.programId) {
    actions.push({
      id: "install",
      label: "Install",
      kind: "install",
      communitySlug: input.communitySlug,
    });
    actions.push({
      id: "program",
      label: "Create program",
      kind: "create_program",
      communitySlug: input.communitySlug,
      templateId: input.templateId,
    });
    actions.push({
      id: "sensor",
      label: "Connect sensor",
      kind: "connect_sensor",
      communitySlug: input.communitySlug,
      href: `/communities/${input.communitySlug}`,
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

  if (input.type === "creator") {
    actions.push({ id: "claim", label: "Claim", kind: "claim", href: "/claim" });
  }

  return actions;
}

export function dataSourceForNodeType(type: string, fromLedger: boolean): DiscoverDataSource {
  if (fromLedger) return "supabase_ledger";
  if (type === "repository" || type === "person") return "github";
  if (type === "community") return "catalog_preview";
  if (type === "connector") return "local_seed";
  return "catalog_preview";
}
