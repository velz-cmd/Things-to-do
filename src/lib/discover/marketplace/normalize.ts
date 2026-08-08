import { createHash } from "node:crypto";
import type {
  FundingStatus,
  MarketplaceOpportunity,
  OpportunityCreatorType,
  OpportunityType,
  ProviderPreference,
} from "./contracts";
import {
  discoverNavigationAction,
  workbenchAction,
} from "./action-contract";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type PersistedOpportunityRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  type: string;
  status: string;
  creatorType: string;
  creatorId: string | null;
  creatorName: string;
  creatorAvatar: string | null;
  communityId: string | null;
  communityName: string | null;
  poolId: string | null;
  poolName: string | null;
  projectId: string | null;
  repository: string | null;
  category: string | null;
  skills: unknown;
  deliverables: unknown;
  evidenceRequirements: unknown;
  eligibility: unknown;
  rewardAmountUsd: number | null;
  rewardToken: string | null;
  rewardNetwork: string | null;
  fundedAmountUsd: number | null;
  fundingGoalUsd: number | null;
  fundingStatus: string | null;
  paymentMode: string | null;
  distributionMethod: string | null;
  preferredProviderId: string | null;
  preferredProviderName: string | null;
  selectedProviderId: string | null;
  selectedProviderName: string | null;
  applicationCount: number;
  capacity: number | null;
  deadline: Date | null;
  location: string | null;
  remote: boolean | null;
  estimatedDelivery: string | null;
  sourceType: string;
  sourceId: string;
  verificationStatus: string;
  riskFlags: unknown;
  publishedAt: Date | null;
  updatedAt: Date;
};

export type ProgramOpportunityRow = {
  id: string;
  name: string;
  templateId: string;
  status: string;
  budgetUsd: number;
  rulesJson: string;
  metadataJson: string | null;
  missionId: string | null;
  lastDeployAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    displayName: string | null;
    githubUsername: string | null;
    githubId: string | null;
  };
  install: {
    communitySlug: string;
    status: string;
  };
  fundStakes: Array<{
    principalUsd: number;
    releasedUsd: number;
    status: string;
  }>;
};

export type CampaignOpportunityRow = {
  id: string;
  creatorUserId: string;
  name: string;
  objective: string;
  contributionType: string;
  verificationAdapterId: string;
  totalBudgetMicroUsdc: bigint;
  committedMicroUsdc: bigint;
  participantCapMicroUsdc: bigint | null;
  startsAt: Date;
  endsAt: Date | null;
  publishedAt: Date | null;
  updatedAt: Date;
  asset: {
    title: string;
    canonicalUrl: string;
  };
  creatorName?: string | null;
};

const opportunityTypes = new Set<OpportunityType>([
  "task",
  "bounty",
  "grant",
  "campaign",
  "role",
  "project_contribution",
  "repository_fix",
  "research_request",
  "community_proposal",
  "creator_collaboration",
  "agent_service_request",
]);

const creatorTypes = new Set<OpportunityCreatorType>([
  "founder",
  "funder",
  "community",
  "dao",
  "individual",
  "creator",
  "maintainer",
  "agent",
  "organisation",
]);

const fundingStatuses = new Set<FundingStatus>([
  "unfunded",
  "partially_funded",
  "funded",
  "escrowed",
  "milestone_funded",
]);

const providerPreferences = new Set<ProviderPreference>([
  "open",
  "preferred",
  "selected",
  "invite_only",
]);

function asOpportunityType(value: string): OpportunityType {
  return opportunityTypes.has(value as OpportunityType)
    ? (value as OpportunityType)
    : "task";
}

function asCreatorType(value: string): OpportunityCreatorType {
  return creatorTypes.has(value as OpportunityCreatorType)
    ? (value as OpportunityCreatorType)
    : "organisation";
}

function asFundingStatus(value: string | null): FundingStatus | undefined {
  return fundingStatuses.has(value as FundingStatus)
    ? (value as FundingStatus)
    : undefined;
}

function asProviderPreference(value: unknown): ProviderPreference {
  return providerPreferences.has(value as ProviderPreference)
    ? (value as ProviderPreference)
    : "open";
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").slice(0, 24);
}

function parseObject(value: string | null): Record<string, JsonValue> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, JsonValue>)
      : {};
  } catch {
    return {};
  }
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function opaqueSlug(source: string, id: string, title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "opportunity";
  const hash = createHash("sha256").update(`${source}:${id}`).digest("hex").slice(0, 10);
  return `${base}-${hash}`;
}

function fundingStatus(funded: number, goal: number): FundingStatus {
  if (funded <= 0) return "unfunded";
  if (goal > 0 && funded >= goal) return "funded";
  return "partially_funded";
}

const POOL_PROGRAM_TEMPLATES = new Set([
  "quadratic-funding",
  "security-fund",
  "user-centric-royalties",
  "video-royalties",
]);

export function programMarketplaceKind(
  templateId: string,
  metadata: Record<string, unknown>,
): "pool" | "program" {
  const configuredKind = optionalString(metadata.marketplaceKind)?.toLowerCase();
  if (configuredKind === "pool" || configuredKind === "program") return configuredKind;
  return POOL_PROGRAM_TEMPLATES.has(templateId) ? "pool" : "program";
}

export function normalizePersistedOpportunity(
  row: PersistedOpportunityRow,
): MarketplaceOpportunity {
  const preference: ProviderPreference = row.selectedProviderId
    ? "selected"
    : row.preferredProviderId
      ? "preferred"
      : "open";

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    type: asOpportunityType(row.type),
    status: row.status,
    creator: {
      type: asCreatorType(row.creatorType),
      id: row.creatorId ?? undefined,
      name: row.creatorName,
      avatar: row.creatorAvatar ?? undefined,
      verified: row.verificationStatus === "verified",
    },
    community: row.communityName
      ? { id: row.communityId ?? undefined, name: row.communityName }
      : undefined,
    pool: row.poolName ? { id: row.poolId ?? undefined, name: row.poolName } : undefined,
    projectId: row.projectId ?? undefined,
    repository: row.repository ?? undefined,
    category: row.category ?? undefined,
    skills: stringArray(row.skills),
    deliverables: stringArray(row.deliverables),
    evidenceRequirements: stringArray(row.evidenceRequirements),
    eligibility: stringArray(row.eligibility),
    reward:
      row.rewardAmountUsd != null || row.rewardToken || row.rewardNetwork
        ? {
            amountUsd: row.rewardAmountUsd ?? undefined,
            token: row.rewardToken ?? undefined,
            network: row.rewardNetwork ?? undefined,
          }
        : undefined,
    funding:
      row.fundedAmountUsd != null ||
      row.fundingGoalUsd != null ||
      row.fundingStatus ||
      row.poolName
        ? {
            fundedAmountUsd: row.fundedAmountUsd ?? undefined,
            goalAmountUsd: row.fundingGoalUsd ?? undefined,
            status: asFundingStatus(row.fundingStatus),
            source: row.poolName ?? undefined,
            paymentMode: row.paymentMode ?? undefined,
            distributionMethod: row.distributionMethod ?? undefined,
            amountState:
              row.fundingStatus === "funded" &&
              row.verificationStatus === "settlement_confirmed"
                ? "confirmed"
                : "provenance_unavailable",
          }
        : undefined,
    provider: {
      preference,
      preferred:
        row.preferredProviderId && row.preferredProviderName
          ? { id: row.preferredProviderId, name: row.preferredProviderName }
          : undefined,
      selected:
        row.selectedProviderId && row.selectedProviderName
          ? { id: row.selectedProviderId, name: row.selectedProviderName }
          : undefined,
    },
    applicationCount: row.applicationCount || undefined,
    capacity: row.capacity ?? undefined,
    deadline: row.deadline?.toISOString(),
    location: row.location ?? undefined,
    remote: row.remote ?? undefined,
    estimatedDelivery: row.estimatedDelivery ?? undefined,
    publishedAt: (row.publishedAt ?? row.updatedAt).toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    verificationStatus: row.verificationStatus,
    riskFlags: stringArray(row.riskFlags),
    source: { type: row.sourceType, id: row.sourceId },
    marketplaceKind: row.poolName ? "pool" : "opportunity",
  };
}

export function normalizeProgramOpportunity(
  row: ProgramOpportunityRow,
): MarketplaceOpportunity {
  const metadata = parseObject(row.metadataJson);
  const rules = parseObject(row.rulesJson);
  const communityName =
    optionalString(metadata.communityName) ??
    row.install.communitySlug
      .split("-")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ");
  const fundedAmountUsd = row.fundStakes
    .filter((stake) => stake.status === "active" || stake.status === "target_met")
    .reduce((total, stake) => total + stake.principalUsd, 0);
  const type =
    row.templateId.includes("repository") || optionalString(metadata.repository)
      ? "repository_fix"
      : row.templateId.includes("creator") || row.templateId.includes("royalt")
        ? "creator_collaboration"
        : "grant";
  const preference = asProviderPreference(metadata.providerPreference);
  const preferredProviderId = optionalString(metadata.preferredProviderId);
  const preferredProviderName = optionalString(metadata.preferredProviderName);
  const selectedProviderId = optionalString(metadata.selectedProviderId);
  const selectedProviderName = optionalString(metadata.selectedProviderName);
  const creatorName =
    row.user.displayName ?? row.user.githubUsername ?? "RESOLVE community operator";
  const publicationApproved = metadata.publicationStatus === "approved";
  const policyActive = metadata.policyStatus === "active";
  const treasuryAddress = optionalString(metadata.treasuryAddress);
  const treasuryReady = Boolean(treasuryAddress?.match(/^0x[a-fA-F0-9]{40}$/));
  const financialReady = publicationApproved && policyActive && treasuryReady;
  const marketplaceKind = programMarketplaceKind(row.templateId, metadata);
  const setupBlocker = !publicationApproved
    ? "Approve this Program for public discovery."
    : !policyActive
      ? "Activate a versioned funding policy."
      : !treasuryReady
        ? "Add a valid Arc treasury destination."
        : undefined;
  const setupStep = !publicationApproved
    ? "publication"
    : !policyActive
      ? "policy"
      : !treasuryReady
        ? "treasury"
        : "review";
  const setupLabel = setupStep === "publication"
    ? "Review publication"
    : setupStep === "policy"
      ? "Design policy"
      : setupStep === "treasury"
        ? "Add treasury destination"
        : "Review program";

  return {
    id: `program:${row.id}`,
    slug: opaqueSlug("program", row.id, row.name),
    title: row.name,
    summary:
      optionalString(metadata.summary) ??
      `An active ${communityName} funding program for verified work.`,
    description:
      optionalString(metadata.description) ??
      optionalString(rules.description) ??
      `This program publishes a real funding budget and applies its configured verification rules before settlement.`,
    type,
    status: "open",
    creator: {
      type: asCreatorType(optionalString(metadata.creatorType) ?? "community"),
      id: row.user.id,
      name: creatorName,
      verified: Boolean(row.user.githubUsername),
    },
    community: { id: row.install.communitySlug, name: communityName },
    pool: marketplaceKind === "pool" ? { id: row.id, name: row.name } : undefined,
    program: { id: row.id, name: row.name, templateId: row.templateId },
    marketplaceKind,
    repository: optionalString(metadata.repository),
    projectId: optionalString(metadata.projectId),
    category: optionalString(metadata.category),
    skills: stringArray(metadata.skills),
    deliverables: stringArray(metadata.deliverables),
    evidenceRequirements: stringArray(
      metadata.evidenceRequirements ?? rules.evidenceRequirements,
    ),
    eligibility: stringArray(metadata.eligibility ?? rules.eligibility),
    reward:
      row.budgetUsd > 0
        ? {
            amountUsd: row.budgetUsd,
            token: optionalString(metadata.rewardToken) ?? "USDC",
            network: optionalString(metadata.rewardNetwork),
          }
        : undefined,
    funding:
      row.budgetUsd > 0 || fundedAmountUsd > 0
        ? {
            fundedAmountUsd: undefined,
            pendingAmountUsd: fundedAmountUsd > 0 ? fundedAmountUsd : undefined,
            goalAmountUsd: row.budgetUsd > 0 ? row.budgetUsd : undefined,
            status: fundedAmountUsd > 0 ? "partially_funded" : "unfunded",
            source: row.name,
            paymentMode: optionalString(metadata.paymentMode),
            distributionMethod: optionalString(metadata.distributionMethod),
            amountState: fundedAmountUsd > 0 ? "provenance_unavailable" : "configured_target",
          }
        : undefined,
    provider: {
      preference: selectedProviderId
        ? "selected"
        : preferredProviderId
          ? "preferred"
          : preference,
      preferred:
        preferredProviderId && preferredProviderName
          ? { id: preferredProviderId, name: preferredProviderName }
          : undefined,
      selected:
        selectedProviderId && selectedProviderName
          ? { id: selectedProviderId, name: selectedProviderName }
          : undefined,
    },
    capacity: optionalNumber(metadata.capacity),
    deadline: optionalString(metadata.deadline),
    location: optionalString(metadata.location),
    remote: optionalBoolean(metadata.remote),
    estimatedDelivery: optionalString(metadata.estimatedDelivery),
    publishedAt: (row.lastDeployAt ?? row.createdAt).toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    verificationStatus:
      optionalString(metadata.verificationStatus) ??
      (financialReady ? "funding_ready" : `${setupStep}_required`),
    riskFlags: stringArray(metadata.riskFlags),
    source: { type: "community_program", id: row.id },
    entityState: {
      provenance:
        metadata.provenance === "operator_created"
          ? "operator_created"
          : "legacy_operator_record",
      lifecycle: publicationApproved ? "published" : "active",
      financialReadiness: financialReady ? "ready" : "setup_required",
      blocker: setupBlocker,
    },
    primaryAction: financialReady && marketplaceKind === "pool"
      ? workbenchAction({
          id: "capital.open_funding",
          label: "Fund Pool",
          href: `/discover?view=explore&kind=pools&action=capital.open_funding&subject=${encodeURIComponent(row.id)}`,
        }, {
          panel: "pool_funding",
          subjectId: row.id,
          programId: row.id,
          communitySlug: row.install.communitySlug,
          poolName: row.name,
        }, { requiresConfirmation: true })
      : financialReady
        ? workbenchAction({
            id: "discover.open_program",
            label: "View Program",
            href: `/discover?view=explore&kind=programs&action=discover.open_program&subject=${encodeURIComponent(row.id)}`,
          }, {
            panel: "entity_details",
            subjectId: row.id,
            entityType: "program",
          })
      : workbenchAction({
          id: setupStep === "policy" ? "program.update_policy" : "community.open",
          label: setupLabel,
          href: `/discover?view=explore&kind=programs&action=${setupStep === "policy" ? "program.update_policy" : "community.open"}&subject=${encodeURIComponent(row.id)}`,
          description: setupBlocker,
        }, {
          panel: "program_setup",
          subjectId: row.id,
          programId: row.id,
          communitySlug: row.install.communitySlug,
          step: setupStep,
        }),
    secondaryActions: [],
  };
}

export function normalizeCampaignOpportunity(
  row: CampaignOpportunityRow,
): MarketplaceOpportunity {
  const budgetUsd = Number(row.totalBudgetMicroUsdc) / 1_000_000;
  const committedUsd = Number(row.committedMicroUsdc) / 1_000_000;
  const creatorName = row.creatorName ?? "Verified creator";

  return {
    id: `campaign:${row.id}`,
    slug: opaqueSlug("campaign", row.id, row.name),
    title: row.name,
    summary: row.objective.slice(0, 220),
    description: row.objective,
    type: "campaign",
    status: "open",
    creator: {
      type: "creator",
      id: row.creatorUserId,
      name: creatorName,
      verified: true,
    },
    projectId: row.asset.canonicalUrl,
    category: row.contributionType,
    skills: [],
    deliverables: [row.asset.title],
    evidenceRequirements: [
      `Evidence is verified through ${row.verificationAdapterId}.`,
    ],
    eligibility: [],
    reward: {
      amountUsd:
        row.participantCapMicroUsdc != null
          ? Number(row.participantCapMicroUsdc) / 1_000_000
          : budgetUsd,
      token: "USDC",
    },
    funding: {
      fundedAmountUsd: committedUsd,
      goalAmountUsd: budgetUsd,
      status: fundingStatus(committedUsd, budgetUsd),
      source: "Outcome campaign budget",
      distributionMethod: "Verified outcome",
      amountState: "funding_reserved",
    },
    provider: { preference: "open" },
    deadline: row.endsAt?.toISOString(),
    publishedAt: (row.publishedAt ?? row.startsAt).toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    verificationStatus: "verified",
    riskFlags: [],
    source: { type: "outcome_campaign", id: row.id },
    marketplaceKind: "opportunity",
  };
}
