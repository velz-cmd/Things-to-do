import type { AutomationTrigger } from "@/lib/automation/types";
import { defaultTriggerForCommunityKind } from "@/lib/automation/simulate";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import {
  automateLabelFor,
  defaultTriggerForTemplate,
} from "@/lib/discover/automate-action-labels";
import type { DiscoverGraphEdge, DiscoverGraphNode } from "./radar";
import { hasFundingGapEdge } from "./graph-domain";
import type { DiscoverAction, DiscoverDataSource, DiscoverIntent } from "./types";

import { QUICK_ACTION_WHY } from "@/lib/discover/resolve-value-copy";

function actionReason(kind: DiscoverAction["kind"], extra?: string): string {
  return extra ?? QUICK_ACTION_WHY[kind] ?? "Move verified value on Arc";
}

function defaultTemplateForNode(node: DiscoverGraphNode): string {
  if (node.templateId) return node.templateId;
  if (node.graphDomain === "music") return "user-centric-royalties";
  if (node.graphDomain === "research") return "citation-toll";
  if (node.type === "ecosystem" || node.type === "repository") return "docs-bounty";
  return "docs-bounty";
}

export function defaultAutomationTriggerForNode(node: DiscoverGraphNode): AutomationTrigger {
  if (node.graphDomain === "music") return "play";
  if (node.graphDomain === "research") return "citation";
  const community = node.communitySlug ? getCommunityBySlug(node.communitySlug) : null;
  if (community?.kind === "media") return "view";
  if (community) return defaultTriggerForCommunityKind(community.kind);
  return "docs_merge";
}

function receiptIdFromNode(node: DiscoverGraphNode): string | undefined {
  return node.proofHref?.match(/\/receipt\/([^/?#]+)/)?.[1];
}

function receiptActions(node: DiscoverGraphNode): DiscoverAction[] {
  const receiptId = receiptIdFromNode(node);
  if (!receiptId) return [];
  return [
    {
      id: "arcscan",
      label: "Open Arcscan",
      kind: "open",
      href: node.proofHref ?? `/receipt/${receiptId}`,
      reason: "View on-chain settlement proof",
    },
    {
      id: "share",
      label: "Share receipt",
      kind: "share",
      href: `/receipt/${receiptId}`,
    },
  ];
}

/** Node panel actions — concrete money/proof moves, no vague Observe/Automate. */
export function bubbleOperatorActions(
  node: DiscoverGraphNode,
  edges: DiscoverGraphEdge[],
): DiscoverAction[] {
  const actions: DiscoverAction[] = [];
  const slug = node.communitySlug;
  const templateId = defaultTemplateForNode(node);
  const gapEdge = hasFundingGapEdge(node.id, edges);
  const canFund =
    gapEdge ||
    ((node.moneyGapUsd ?? 0) > 0 &&
      (node.type === "repository" || node.type === "ecosystem" || node.programId)) ||
    node.pendingFunding;

  if (receiptIdFromNode(node)) {
    return receiptActions(node);
  }

  if (node.type === "person" || node.type === "creator") {
    if (canFund && (node.programId || slug)) {
      actions.push({
        id: "fund-payout",
        label: "Fund this payout",
        kind: "fund",
        reason: actionReason("fund"),
        programId: node.programId,
        communitySlug: slug,
        templateId,
        missionId: node.missionId,
        amountUsd:
          node.moneyGapUsd != null && node.moneyGapUsd > 0
            ? Math.max(5, Math.min(node.moneyGapUsd, 500))
            : undefined,
      });
    }
    actions.push({
      id: "proof",
      label: "Open proof",
      kind: "open",
      entityPath: node.entityPath ?? (slug ? `/communities/${slug}` : undefined),
      communitySlug: slug,
    });
    actions.push({
      id: "identity",
      label: "View identity",
      kind: "open",
      entityPath: node.entityPath ?? `/profile`,
    });
    if (node.authorizationStatus === "claimable") {
      actions.push({
        id: "claim",
        label: "Claim route",
        kind: "claim",
        programId: node.programId,
        communitySlug: slug,
      });
    } else if (canFund) {
      actions.push({
        id: "settle",
        label: "Settle via Arc",
        kind: "fund",
        programId: node.programId,
        communitySlug: slug,
        templateId,
        missionId: node.missionId,
      });
    }
    return actions.slice(0, 4);
  }

  if (node.type === "community" || node.programId) {
    if (canFund) {
      actions.push({
        id: "fund-program",
        label: "Fund program",
        kind: "fund",
        programId: node.programId,
        communitySlug: slug,
        templateId,
        missionId: node.missionId,
      });
    }
    if (slug) {
      actions.push({
        id: "program",
        label: "Create program",
        kind: "create_program",
        communitySlug: slug,
        templateId,
      });
      actions.push({
        id: "automate",
        label: automateLabelFor({
          templateId,
          automationTrigger: defaultAutomationTriggerForNode(node),
        }),
        kind: "automate",
        communitySlug: slug,
        templateId,
        automationTrigger: defaultAutomationTriggerForNode(node),
      });
      actions.push({
        id: "connect",
        label: "Connect source",
        kind: "connect_sensor",
        href: "/profile",
        communitySlug: slug,
      });
      actions.push({
        id: "unpaid",
        label: "View unpaid value",
        kind: "open",
        href: "/discover#discover-workspace",
        communitySlug: slug,
      });
    }
    return actions.slice(0, 4);
  }

  if (slug) {
    if (canFund) {
      actions.push({
        id: "fund",
        label: gapEdge || node.pendingFunding ? "Fund this payout" : "Fund program",
        kind: "fund",
        reason: actionReason("fund"),
        programId: node.programId,
        communitySlug: slug,
        templateId,
        missionId: node.missionId,
      });
    }
    actions.push({
      id: "rules",
      label: "View rules",
      kind: "open",
      entityPath: `/communities/${slug}`,
      communitySlug: slug,
    });
    if (slug) {
      actions.push({
        id: `automate-${templateId}`,
        label: automateLabelFor({
          templateId,
          automationTrigger: defaultTriggerForTemplate(templateId),
        }),
        kind: "automate",
        communitySlug: slug,
        templateId,
        automationTrigger: defaultTriggerForTemplate(templateId),
      });
    }
    actions.push({
      id: "settle-queue",
      label: "Settle queue",
      kind: "fund",
      programId: node.programId,
      communitySlug: slug,
      templateId,
    });
    return actions.slice(0, 4);
  }

  if (node.entityPath) {
    actions.push({
      id: "proof",
      label: "Open proof",
      kind: "analyze",
      entityPath: node.entityPath,
    });
    if (canFund) {
      actions.push({
        id: "sponsor",
        label: "Fund this payout",
        kind: "sponsor",
        programId: node.programId,
        templateId,
        missionId: node.missionId,
      });
    }
  }

  if (node.synthetic && slug) {
    actions.push({
      id: "activate",
      label: "Activate community",
      kind: "install",
      communitySlug: slug,
    });
  }

  return actions.slice(0, 4);
}

export function bubblePopoverActions(
  node: DiscoverGraphNode,
  edges: DiscoverGraphEdge[],
): DiscoverAction[] {
  return bubbleOperatorActions(node, edges);
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
    actions.push({ id: "proof", label: "Open proof", kind: "open", entityPath: input.entityPath });
  }

  if ((input.programId || input.communitySlug || input.missionId) && !input.synthetic) {
    actions.push({
      id: "fund",
      label: "Fund this payout",
      kind: "fund",
      programId: input.programId,
      communitySlug: input.communitySlug,
      templateId: input.templateId,
      missionId: input.missionId,
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
  if (type === "community" || type === "ecosystem") return "community_catalog";
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
