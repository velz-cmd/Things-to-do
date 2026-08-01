import type {
  DiscoverView,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";
import type { ProgramOpportunityRow } from "@/lib/discover/marketplace/normalize";

const SUPPORTED_PROGRAM_TEMPLATES = new Set([
  "docs-bounty",
  "docs-grant",
  "security-fund",
]);

const SUPPORTED_PUBLIC_CONNECTORS = new Set(["github"]);

const PUBLIC_PROVENANCE = new Set([
  "external_user",
  "external_integration",
  "operator_created",
]);

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function programConnector(row: Pick<ProgramOpportunityRow, "rulesJson" | "metadataJson">) {
  const metadata = parseJsonObject(row.metadataJson);
  const rules = parseJsonObject(row.rulesJson);
  return String(metadata.sourceConnector ?? rules.connectorId ?? "").toLowerCase();
}

export function programEntityVisible(
  row: Pick<
    ProgramOpportunityRow,
    | "templateId"
    | "status"
    | "missionId"
    | "budgetUsd"
    | "metadataJson"
    | "rulesJson"
    | "user"
    | "install"
  >,
): boolean {
  if (!["active", "deployed"].includes(row.status)) return false;
  if (!row.missionId || row.budgetUsd < 0 || row.install.status !== "active") return false;
  if (!row.user.githubId && !row.user.githubUsername) return false;

  const metadata = parseJsonObject(row.metadataJson);
  if (
    metadata.isDemo === true ||
    metadata.fixture === true ||
    metadata.visibility === "private" ||
    String(metadata.provenance ?? "") === "synthetic_demo"
  ) {
    return false;
  }

  const repository = typeof metadata.repository === "string" ? metadata.repository.trim() : "";
  const supportedTemplate = SUPPORTED_PROGRAM_TEMPLATES.has(row.templateId);
  const supportedConnector = SUPPORTED_PUBLIC_CONNECTORS.has(programConnector(row));
  return supportedConnector && (supportedTemplate || /^[\w.-]+\/[\w.-]+$/.test(repository));
}

export function programPublicationEligible(
  row: Pick<
    ProgramOpportunityRow,
    | "templateId"
    | "status"
    | "missionId"
    | "budgetUsd"
    | "metadataJson"
    | "rulesJson"
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
  if (
    metadata.isDemo === true ||
    metadata.fixture === true ||
    metadata.visibility === "private"
  ) {
    return false;
  }
  if (metadata.publicationStatus !== "approved") return false;
  if (!PUBLIC_PROVENANCE.has(String(metadata.provenance ?? ""))) return false;
  if (metadata.policyStatus !== "active") return false;
  if (!nonEmptyString(metadata.treasuryAddress)) return false;
  if (!/^0x[a-fA-F0-9]{40}$/.test(metadata.treasuryAddress)) return false;
  if (!nonEmptyString(metadata.publicationVersion)) return false;
  if (!SUPPORTED_PUBLIC_CONNECTORS.has(programConnector(row))) {
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
      opportunity.source.type === "github_evidence" ||
      opportunity.source.type === "repository_snapshot" ||
      (opportunity.source.type === "canonical_opportunity" &&
        ["project_contribution", "repository_fix", "task", "bounty"].includes(
          opportunity.type,
        ))
    );
  }
  if (view === "pools") return Boolean(opportunity.pool);
  if (view === "outcomes") return opportunity.source.type === "confirmed_receipt";
  if (view === "people" || view === "my_communities") return false;
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
