import type {
  DiscoverAction,
  DiscoverCommunity,
  DiscoverExploreKind,
  DiscoverIntent,
  DiscoverMyCommunity,
  DiscoverPerson,
  DiscoverPool,
  EconomicActionItem,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";
import {
  discoverNavigationAction,
  workbenchAction,
} from "@/lib/discover/marketplace/action-contract";

type BuildEconomicActionsInput = {
  opportunities: MarketplaceOpportunity[];
  people: DiscoverPerson[];
  communities: DiscoverCommunity[];
  pools: DiscoverPool[];
  myCommunities: DiscoverMyCommunity[];
  viewerUserId?: string;
};

const workTypes = new Set(["project_contribution", "repository_fix", "task", "bounty"]);

function programSetupAction(
  item: MarketplaceOpportunity,
  returnTo: string,
): DiscoverAction {
  const blocker = item.entityState?.blocker?.toLowerCase() ?? "";
  const step = blocker.includes("publish")
    ? "publication"
    : blocker.includes("policy")
      ? "policy"
      : blocker.includes("treasury")
        ? "treasury"
        : "review";
  const label = step === "publication"
    ? "Review publication"
    : step === "policy"
      ? "Design policy"
      : step === "treasury"
        ? "Add treasury destination"
        : "Review program";
  const slug = item.community?.id ?? item.community?.name ?? "";
  const programId = item.pool?.id ?? item.source.id;
  return workbenchAction({
    id: step === "policy" ? "program.update_policy" : "community.open",
    label,
    href: `${returnTo}&action=${step === "policy" ? "program.update_policy" : "community.open"}&subject=${encodeURIComponent(programId)}`,
    description: item.entityState?.blocker,
  }, {
    panel: "program_setup",
    subjectId: programId,
    programId,
    communitySlug: slug,
    step,
  });
}

function isWork(item: MarketplaceOpportunity) {
  if (item.source.type === "github_evidence" || item.source.type === "repository_snapshot") {
    return true;
  }
  if (item.source.type === "community_program" || item.source.type === "confirmed_receipt") {
    return false;
  }
  return workTypes.has(item.type);
}

function actionFromOpportunity(
  item: MarketplaceOpportunity,
  viewerUserId?: string,
): EconomicActionItem {
  const returnTo = `/discover?view=explore&item=${encodeURIComponent(item.id)}`;
  const owner = Boolean(viewerUserId && item.creator.id === viewerUserId);
  const confirmed = item.source.type === "confirmed_receipt";
  const acceptedWork = isWork(item) && !item.pool;
  const program = item.source.type === "community_program";
  const pool = item.marketplaceKind === "pool";
  const blocker = item.entityState?.blocker;
  const setupAction = program && owner ? programSetupAction(item, returnTo) : null;
  const detailAction: DiscoverAction = workbenchAction({
        id: "discover.open_evidence",
        label: acceptedWork ? "Inspect evidence" : "Inspect economic state",
        href: `${returnTo}&action=discover.open_evidence&subject=${encodeURIComponent(item.source.id)}`,
      }, {
        panel: "evidence",
        subjectId: item.source.id,
        sourceUrl: item.sourceUrl,
        repository: item.repository,
        evidenceIds: [item.source.id],
      });
  const primaryAction = setupAction ?? (acceptedWork || confirmed ? item.primaryAction ?? detailAction : detailAction);
  const amountState = item.funding?.amountState ?? (confirmed ? "confirmed" : "provenance_unavailable");
  const subjectType = confirmed
    ? "receipt"
    : acceptedWork
      ? "accepted_work"
      : pool
        ? "community_pool"
      : program && blocker
        ? "policy_blocker"
        : item.pool
          ? "community_pool"
          : "active_program";
  const lifecycle = confirmed
    ? "confirmed"
    : acceptedWork
      ? "evidence_verified"
      : blocker?.toLowerCase().includes("policy")
        ? "policy_required"
        : blocker?.toLowerCase().includes("treasury")
          ? "treasury_required"
          : blocker
            ? "blocked"
            : item.entityState?.financialReadiness === "ready"
              ? "ready_for_funding"
              : "observed";
  const happened = confirmed
    ? "An Arc settlement confirmed and RESOLVE issued a receipt."
    : acceptedWork
      ? item.summary
      : program
        ? `${item.community?.name ?? "A community"} created ${item.title} for verified activity.`
        : item.summary;
  const whyItMatters = confirmed
    ? "The transaction, authorization, and public proof can be inspected together."
    : acceptedWork
      ? item.primaryAction?.id === "discover.fund_verified_work"
        ? "Attribution, source evidence, and payout readiness passed. A voluntary reward can now be reviewed without creating a policy obligation."
        : blocker ?? "The source proof remains inspectable while recipient readiness is incomplete."
      : blocker
        ? `This item needs one setup step before its public action is available: ${blocker}`
        : "This item has an inspectable source and a valid next step.";

  return {
    id: `economic:${item.source.type}:${item.source.id}`,
    subjectType,
    subjectId: item.source.id,
    headline: confirmed
      ? `${item.title} has a confirmed receipt`
      : acceptedWork
        ? `${item.creator.name} completed accepted work in ${item.repository ?? item.community?.name ?? "a verified source"}`
        : blocker
          ? `${item.title} needs setup`
          : `${item.title} is ready for review`,
    happened,
    whyItMatters,
    lifecycle,
    blocker,
    audience: program && owner && !pool ? "operator" : acceptedWork ? "public" : "funder",
    community: item.community,
    repository: item.repository,
    person: item.creator.id ? { id: item.creator.id, name: item.creator.name } : { name: item.creator.name },
    source: {
      provider: item.source.type,
      label: item.repository ?? item.community?.name ?? item.source.type.replaceAll("_", " "),
      href: item.sourceUrl,
      lastObservedAt: item.updatedAt,
      stale: false,
    },
    evidenceIds: item.source.type === "github_evidence" ? [item.source.id] : [],
    attributionState: acceptedWork ? "verified" : "not_applicable",
    programId: program ? item.source.id : undefined,
    policyState: program ? (blocker?.toLowerCase().includes("policy") ? "missing" : item.entityState?.financialReadiness === "ready" ? "active" : "approval_required") : "not_applicable",
    poolId: item.pool?.id,
    settlementId: confirmed ? item.source.id : undefined,
    receiptId: confirmed ? item.source.id : undefined,
    amount: item.reward || item.funding
      ? {
          valueUsd: confirmed ? item.funding?.fundedAmountUsd : item.reward?.amountUsd,
          token: item.reward?.token ?? "USDC",
          state: amountState,
        }
      : undefined,
    fundingReadiness: item.entityState?.financialReadiness === "ready"
      ? "ready"
      : acceptedWork || item.pool || program
        ? "blocked"
        : "not_applicable",
    recipientReadiness: acceptedWork
      ? item.creator.id && !blocker ? "ready" : "setup_required"
      : "not_applicable",
    primaryAction,
    secondaryActions: [
      ...(item.sourceUrl && primaryAction.href !== item.sourceUrl
        ? [discoverNavigationAction({ id: "discover.open_repository", label: "Open source", href: item.sourceUrl }, { target: "external", secondary: true })]
        : []),
      ...((item.secondaryActions ?? []).filter((action) => action.href !== primaryAction.href)),
    ].slice(0, 2),
    visibility: "public",
    createdAt: item.publishedAt,
    updatedAt: item.updatedAt,
  };
}

function actionFromPerson(person: DiscoverPerson, viewerUserId?: string): EconomicActionItem {
  const isSelf = person.id === viewerUserId;
  const unclaimed = person.identityState === "unclaimed_contributor";
  return {
    id: `economic:person:${person.id}`,
    subjectType: unclaimed ? "identity_blocker" : person.payoutReadiness === "ready" ? "contributor" : "payout_blocker",
    subjectId: person.id,
    headline: unclaimed
      ? `${person.name} created accepted work but has not claimed the attribution`
      : person.payoutReadiness === "ready"
      ? `${person.name} is ready to receive support`
      : `${person.name} has a claimed GitHub profile but no verified payout route`,
    happened: person.description ?? `${person.name} is attributed to a persisted GitHub identity.`,
    whyItMatters: unclaimed
      ? "The work remains visible with its source proof. Funding stays unavailable until the contributor claims the identity and verifies a payout destination."
      : person.payoutReadiness === "ready"
      ? "Identity and recipient readiness have passed the checks required before support can be prepared."
      : "The contributor remains discoverable, but RESOLVE cannot offer a payment action until a payout destination is verified.",
    lifecycle: person.payoutReadiness === "ready" ? "ready_for_funding" : "identity_required",
    blocker: person.blocker,
    audience: isSelf ? "contributor" : "funder",
    person: { id: person.id, name: person.name },
    source: { provider: "github", label: person.verifiedIdentities.join(", ") || "GitHub identity", stale: false },
    evidenceIds: [],
    attributionState: person.identityState === "unclaimed_contributor" ? "unresolved" : "claimed",
    policyState: "not_applicable",
    fundingReadiness: person.acceptsDirectFunding ? "ready" : "blocked",
    recipientReadiness: person.payoutReadiness === "ready" ? "ready" : "setup_required",
    primaryAction: person.primaryAction,
    secondaryActions: person.secondaryActions.slice(0, 2),
    visibility: "public",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function actionFromCommunity(community: DiscoverCommunity): EconomicActionItem {
  return {
    id: `economic:community:${community.id}`,
    subjectType: "community",
    subjectId: community.id,
    headline: `${community.name} has inspectable economic activity`,
    happened: community.recentActivity ?? community.purpose,
    whyItMatters: "People, programs, funding rules, and confirmed outcomes can be reviewed in their owning community context.",
    lifecycle: "observed",
    audience: "public",
    community: { id: community.slug, name: community.name },
    source: { provider: "resolve", label: community.name, stale: false },
    evidenceIds: [],
    attributionState: "not_applicable",
    policyState: "not_applicable",
    fundingReadiness: "not_applicable",
    recipientReadiness: "not_applicable",
    primaryAction: discoverNavigationAction({
      id: "community.open",
      label: "Open community activity",
      href: `/discover?view=explore&kind=communities&community=${encodeURIComponent(community.slug)}`,
    }),
    secondaryActions: [],
    visibility: "public",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function actionFromPool(pool: DiscoverPool): EconomicActionItem {
  const fundingReady = pool.lifecycleState === "accepting_funding";
  const submitted = pool.lifecycleState === "funding_pending";
  const confirmed = ["funded", "checkpoint_pending", "ready_for_distribution", "distribution_submitted", "completed"].includes(pool.lifecycleState);
  return {
    id: `economic:pool:${pool.id}`,
    subjectType: "community_pool",
    subjectId: pool.id,
    headline: fundingReady ? `${pool.name} can accept Arc USDC` : `${pool.name} has a specific funding requirement`,
    happened: pool.purpose ?? `${pool.owner} published a ${pool.type.toLowerCase()} for ${pool.communitySlug}.`,
    whyItMatters: pool.blocker
      ? `The Pool remains publicly inspectable, but money cannot move until this requirement is resolved: ${pool.blocker}`
      : "Funding follows the published Pool rule. Funders provide capital and the policy controls eligible distributions.",
    lifecycle: submitted ? "submitted" : confirmed ? "confirmed" : fundingReady ? "ready_for_funding" : pool.treasuryReadiness === "setup_required" ? "treasury_required" : pool.policyState === "setup_required" ? "policy_required" : "blocked",
    blocker: pool.blocker,
    audience: "funder",
    community: { id: pool.communitySlug, name: pool.communitySlug },
    source: { provider: "resolve_pool", label: `${pool.communitySlug} / ${pool.type}`, stale: false },
    evidenceIds: [],
    attributionState: "not_applicable",
    policyState: pool.policyState === "active" ? "active" : pool.policyState === "setup_required" ? "missing" : "approval_required",
    poolId: pool.id,
    amount: pool.targetUsd != null ? { valueUsd: pool.targetUsd, token: pool.token ?? "USDC", state: pool.balanceState ?? "configured_target" } : undefined,
    poolDetails: {
      type: pool.type,
      owner: pool.owner,
      purpose: pool.purpose,
      confirmedBalanceUsd: pool.balanceUsd,
      pendingDepositsUsd: pool.pendingDepositsUsd,
      availableBalanceUsd: pool.availableUsd,
      targetUsd: pool.targetUsd,
      policyState: pool.policyState,
      treasuryReadiness: pool.treasuryReadiness,
      distributionMethod: pool.governanceModel ?? pool.applicationModel,
      network: pool.network ?? "Arc Testnet",
    },
    fundingReadiness: fundingReady ? "ready" : "blocked",
    recipientReadiness: "not_applicable",
    primaryAction: pool.primaryAction,
    secondaryActions: pool.secondaryActions.slice(0, 2),
    visibility: "public",
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function dedupe(items: EconomicActionItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalizedHeadline = item.headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const key = item.subjectType === "community_pool"
      ? `community_pool:${item.subjectId}`
      : ["active_program", "policy_blocker"].includes(item.subjectType)
      ? `${item.subjectType}:${item.community?.id ?? ""}:${item.repository ?? ""}:${normalizedHeadline}`
      : `${item.subjectType}:${item.subjectId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildEconomicActions(input: BuildEconomicActionsInput): EconomicActionItem[] {
  const opportunityActions = input.opportunities.map((item) => actionFromOpportunity(item, input.viewerUserId));
  const poolActions = input.pools.map(actionFromPool);
  const peopleActions = input.people.map((person) => actionFromPerson(person, input.viewerUserId));
  const communityActions = input.communities.map(actionFromCommunity);
  const communitiesWithExactProgramActions = new Set(
    opportunityActions
      .filter((item) => item.audience === "operator" && item.programId)
      .map((item) => item.community?.id)
      .filter((id): id is string => Boolean(id)),
  );
  const ownerCommunityActions = input.myCommunities
    .filter((community) => !communitiesWithExactProgramActions.has(community.slug))
    .map((community) => ({
    id: `economic:operator:${community.id}`,
    subjectType: "policy_blocker" as const,
    subjectId: community.id,
    headline: `${community.name} needs setup`,
    happened: `${community.activeProgramCount} active program${community.activeProgramCount === 1 ? "" : "s"} and ${community.repositories.length} connected repositor${community.repositories.length === 1 ? "y" : "ies"} were found.`,
    whyItMatters: "The next requirement must be resolved before accepted activity can become a funded obligation.",
    lifecycle: "blocked" as const,
    blocker: community.blocker,
    audience: "operator" as const,
    community: { id: community.slug, name: community.name },
    repository: community.repositories[0],
    source: { provider: "resolve", label: community.sourceState, stale: community.sourceState === "stale" },
    evidenceIds: [],
    attributionState: "not_applicable" as const,
    policyState: community.activeProgramCount ? "approval_required" as const : "missing" as const,
    fundingReadiness: "blocked" as const,
    recipientReadiness: "not_applicable" as const,
    primaryAction: community.primaryAction,
    secondaryActions: community.secondaryActions.slice(0, 2),
    visibility: "private" as const,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    }));
  return dedupe([...ownerCommunityActions, ...peopleActions, ...poolActions, ...opportunityActions, ...communityActions]);
}

export function actionMatchesIntent(item: EconomicActionItem, intent: DiscoverIntent) {
  if (intent === "explore") return true;
  if (intent === "earn") return item.audience === "contributor" || ["accepted_work", "claim", "payout_blocker", "receipt"].includes(item.subjectType);
  if (intent === "fund") return item.audience === "funder" || ["contributor", "creator", "community_pool", "funding_gap", "receipt"].includes(item.subjectType);
  if (intent === "operate") return item.audience === "operator" || ["policy_blocker", "authorization", "reconciliation_issue", "active_program"].includes(item.subjectType);
  if (intent === "publish") return item.subjectType === "creator" && item.source.provider !== "github";
  return item.subjectType === "settlement" && item.source.provider === "x402";
}

export function actionMatchesExploreKind(item: EconomicActionItem, kind: DiscoverExploreKind) {
  if (item.visibility !== "public") return false;
  if (kind === "all") return true;
  if (kind === "people") return ["contributor", "creator", "identity_blocker", "payout_blocker"].includes(item.subjectType);
  if (kind === "work") return item.subjectType === "accepted_work";
  if (kind === "communities") return item.subjectType === "community";
  if (kind === "pools") return item.subjectType === "community_pool";
  if (kind === "programs") return ["active_program", "policy_blocker"].includes(item.subjectType) && Boolean(item.programId);
  return item.subjectType === "funding_gap" || Boolean(item.blocker?.toLowerCase().includes("fund"));
}

export function rankEconomicActions(items: EconomicActionItem[], signedIn: boolean) {
  const lifecycleScore: Record<EconomicActionItem["lifecycle"], number> = {
    authorization_required: 100,
    identity_required: 90,
    policy_required: 85,
    treasury_required: 80,
    blocked: 70,
    ready_for_funding: 65,
    submitted: 60,
    evidence_verified: 55,
    confirmed: 45,
    attribution_required: 40,
    stale: 35,
    observed: 20,
  };
  return [...items].sort((a, b) => {
    const aPersonal = signedIn && (a.visibility !== "public" || ["operator", "contributor"].includes(a.audience)) ? 30 : 0;
    const bPersonal = signedIn && (b.visibility !== "public" || ["operator", "contributor"].includes(b.audience)) ? 30 : 0;
    return bPersonal + lifecycleScore[b.lifecycle] - (aPersonal + lifecycleScore[a.lifecycle]) ||
      b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
  });
}
