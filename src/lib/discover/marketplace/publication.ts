import type {
  DiscoverView,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";
import type { ProgramOpportunityRow } from "@/lib/discover/marketplace/normalize";

const SUPPORTED_PROGRAM_TEMPLATES = new Set([
  "docs-bounty",
  "docs-grant",
  "security-fund",
  "quadratic-funding",
]);

export function programPublicationEligible(
  row: Pick<
    ProgramOpportunityRow,
    "templateId" | "status" | "missionId" | "budgetUsd" | "metadataJson"
  >,
): boolean {
  if (!["active", "deployed"].includes(row.status)) return false;
  if (!row.missionId || row.budgetUsd < 0) return false;
  let metadata: Record<string, unknown> = {};
  try {
    metadata = row.metadataJson ? JSON.parse(row.metadataJson) : {};
  } catch {
    return false;
  }
  if (metadata.isDemo === true || metadata.fixture === true || metadata.visibility === "private") {
    return false;
  }
  if (SUPPORTED_PROGRAM_TEMPLATES.has(row.templateId)) return true;
  const repository = typeof metadata.repository === "string" ? metadata.repository.trim() : "";
  return /^[\w.-]+\/[\w.-]+$/.test(repository);
}

export function opportunityMatchesView(
  opportunity: MarketplaceOpportunity,
  view: DiscoverView,
): boolean {
  if (view === "work") {
    return (
      opportunity.source.type === "repository_snapshot" ||
      ["project_contribution", "repository_fix", "task", "bounty"].includes(
        opportunity.type,
      )
    );
  }
  if (view === "pools") return Boolean(opportunity.pool);
  if (view === "programs") return opportunity.source.type === "community_program";
  if (view === "outcomes") return opportunity.source.type === "outcome_campaign";
  return true;
}

export const AMOUNT_STATE_LABELS = {
  none: "No amount",
  modelled_estimate: "Modelled estimate",
  policy_calculated: "Policy calculated",
  verified_obligation: "Verified obligation",
  funding_reserved: "Funding reserved",
  claimable: "Claimable",
  submitted: "Submitted",
  partially_confirmed: "Partially confirmed",
  confirmed: "Confirmed",
  failed: "Failed",
  reconciled: "Reconciled",
} as const;

export function amountStateLabel(state: keyof typeof AMOUNT_STATE_LABELS): string {
  return AMOUNT_STATE_LABELS[state];
}
