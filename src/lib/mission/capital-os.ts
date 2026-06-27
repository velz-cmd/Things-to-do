import type { CapabilityId, CapabilityAction, OrchestratorContext } from "@/lib/mission/capabilities/types";
import type { MissionPhase } from "@/lib/mission/phases";
import type { CommunityKind } from "@/lib/mission/community/types";

/** Three jobs RESOLVE performs — not one chatbot mode. */
export type MissionJob = "understand" | "design_capital" | "execute";

/** Operating mode changes reasoning focus without changing the interface. */
export type OperatingMode =
  | "founder"
  | "dao"
  | "maintainer"
  | "creator"
  | "research"
  | "community_manager";

export type CapitalLoopPhase =
  | "observe"
  | "understand"
  | "design_capital"
  | "simulate"
  | "approve"
  | "execute"
  | "measure"
  | "learn";

export type CapitalBlueprintAllocation = {
  category: string;
  percent: number;
  amountUsd?: number;
  reason: string;
};

export type CapitalBlueprintFlow = {
  mechanism: string;
  frequency: string;
  verification: string;
  settlement: string;
};

/** Signature RESOLVE artifact — complete funding operating model. */
export type CapitalBlueprint = {
  title: string;
  community: string;
  totalCapitalUsd: number;
  duration: string;
  distribution: CapitalBlueprintAllocation[];
  recipients: string[];
  flows: CapitalBlueprintFlow[];
  reservePercent: number;
  confidence: number;
  rationale: string;
  rebalanceTriggers: string[];
  successMetrics: string[];
  stopConditions: string[];
};

export const OPERATING_MODES: Array<{
  id: OperatingMode;
  label: string;
  description: string;
}> = [
  { id: "founder", label: "Founder", description: "Treasury, budget, distribution, growth" },
  { id: "dao", label: "DAO", description: "Governance, voting, policies, treasury" },
  { id: "maintainer", label: "Maintainer", description: "Funding, burnout, support, dependencies" },
  { id: "creator", label: "Creator", description: "Royalties, usage, income, audience" },
  { id: "research", label: "Research", description: "Evidence, reports, data, analysis" },
  { id: "community_manager", label: "Community", description: "Moderation, events, contributors, retention" },
];

export const CAPITAL_LOOP_PHASES: Array<{ id: CapitalLoopPhase; label: string }> = [
  { id: "observe", label: "Observe" },
  { id: "understand", label: "Understand" },
  { id: "design_capital", label: "Design" },
  { id: "simulate", label: "Simulate" },
  { id: "approve", label: "Approve" },
  { id: "execute", label: "Execute" },
  { id: "measure", label: "Measure" },
  { id: "learn", label: "Learn" },
];

const FOUNDER = /\b(founder|we have \$|our treasury|our budget|i have \$|allocate \$|deploy \$|fund our|support our ecosystem)\b/i;
const DAO = /\b(dao|governance|voting|multisig|proposal|treasury vote|on.?chain)\b/i;
const MAINTAINER = /\b(maintainer|burnout|bus factor|dependency|upstream|core team|sustain)\b/i;
const CREATOR = /\b(creator|artist|royalt|stream|listen|music|audience|patron)\b/i;
const RESEARCH = /\b(research|citation|paper|academic|grant|arxiv|openalex|climate)\b/i;
const COMMUNITY_MGR = /\b(moderat|community manager|retention|events|contributors|onboard)\b/i;

const DESIGN_CAPITAL =
  /\b(design|policy|treasury plan|distribution plan|how (should|to) (fund|pay|allocate)|build (a )?(grant|funding) program|capital blueprint|we have \$\d|allocate \$\d|deploy \$\d|simulate \$|quadratic|streaming|milestone|retroactive)\b/i;
const EXECUTE_JOB =
  /\b(execute|settle|approve|send funds|move money|authorize|prepare settlement|create distribution|draft dao proposal|generate budget)\b/i;
const UNDERSTAND_JOB =
  /\b(how healthy|who maintains|who deserves|compare|explain|show evidence|map|assess|discover|find|research|what changed|dependency map|governance|contributors|funding history|ecosystem health)\b/i;

export function detectOperatingMode(
  text: string,
  communityKind?: CommunityKind,
): OperatingMode {
  if (FOUNDER.test(text)) return "founder";
  if (DAO.test(text)) return "dao";
  if (MAINTAINER.test(text)) return "maintainer";
  if (CREATOR.test(text) || communityKind === "music") return "creator";
  if (RESEARCH.test(text) || communityKind === "research") return "research";
  if (COMMUNITY_MGR.test(text)) return "community_manager";
  if (communityKind === "dao" || communityKind === "protocol") return "dao";
  return "founder";
}

export function detectMissionJob(
  text: string,
  capability: CapabilityId,
  phase: MissionPhase,
  capitalUsd?: number,
): MissionJob {
  if (EXECUTE_JOB.test(text) || capability === "execute_settlement" || phase === "execute") {
    return "execute";
  }
  if (
    DESIGN_CAPITAL.test(text) ||
    capability === "allocate_capital" ||
    phase === "plan" ||
    Boolean(capitalUsd)
  ) {
    return "design_capital";
  }
  if (UNDERSTAND_JOB.test(text) || capability === "discover_value_leaks" || capability === "compare_ecosystems") {
    return "understand";
  }
  if (capability === "claim_value") return "execute";
  if (capability === "research_ecosystem" || capability === "assess_risk") return "understand";
  return "understand";
}

export function detectCapitalLoopPhase(
  job: MissionJob,
  phase: MissionPhase,
  text: string,
): CapitalLoopPhase {
  if (/\b(simulate|what if|forecast|model)\b/i.test(text)) return "simulate";
  if (/\b(approve|authorize|sign off|confirm)\b/i.test(text)) return "approve";
  if (job === "execute" || phase === "execute") return "execute";
  if (/\b(measure|impact|outcome|did it work)\b/i.test(text)) return "measure";
  if (/\b(learn|rebalance|adjust|update policy)\b/i.test(text)) return "learn";
  if (job === "design_capital" || phase === "plan") return "design_capital";
  if (phase === "explain") return "understand";
  return "observe";
}

function defaultAllocations(ctx: OrchestratorContext, totalUsd: number): CapitalBlueprintAllocation[] {
  const mode = detectOperatingMode(ctx.question, ctx.community.kind);
  const hasMaintainerRisk = ctx.findings.some((f) => f.id === "maintainer-risk");
  const hasFundingGap = ctx.findings.some((f) => f.id === "funding-gap");

  const base: CapitalBlueprintAllocation[] = [];

  if (mode === "creator") {
    return [
      { category: "Artists & creators", percent: 45, amountUsd: Math.round(totalUsd * 0.45), reason: "Direct value creation without fair compensation" },
      { category: "Infrastructure", percent: 15, amountUsd: Math.round(totalUsd * 0.15), reason: "Distribution and hosting costs" },
      { category: "Discovery & promotion", percent: 20, amountUsd: Math.round(totalUsd * 0.2), reason: "Audience growth for underpaid creators" },
      { category: "Community events", percent: 10, amountUsd: Math.round(totalUsd * 0.1), reason: "Live engagement and retention" },
      { category: "Emergency reserve", percent: 10, amountUsd: Math.round(totalUsd * 0.1), reason: "Buffer for creator hardship" },
    ];
  }

  if (mode === "research") {
    return [
      { category: "Principal investigators", percent: 30, amountUsd: Math.round(totalUsd * 0.3), reason: "Lead researchers with citation impact but grant gaps" },
      { category: "Open access & publishing", percent: 15, amountUsd: Math.round(totalUsd * 0.15), reason: "Remove paywall barriers" },
      { category: "Graduate contributors", percent: 20, amountUsd: Math.round(totalUsd * 0.2), reason: "Early-career researchers doing unpaid work" },
      { category: "Data & compute", percent: 15, amountUsd: Math.round(totalUsd * 0.15), reason: "Reproducibility infrastructure" },
      { category: "Education outreach", percent: 10, amountUsd: Math.round(totalUsd * 0.1), reason: "Knowledge transfer" },
      { category: "Emergency reserve", percent: 10, amountUsd: Math.round(totalUsd * 0.1), reason: "Grant timing gaps" },
    ];
  }

  if (mode === "community_manager") {
    return [
      { category: "Moderators", percent: 25, amountUsd: Math.round(totalUsd * 0.25), reason: "Unpaid community safety work" },
      { category: "Event organizers", percent: 20, amountUsd: Math.round(totalUsd * 0.2), reason: "Retention through gatherings" },
      { category: "Onboarding & docs", percent: 20, amountUsd: Math.round(totalUsd * 0.2), reason: "Contributor pipeline" },
      { category: "Contributor grants", percent: 25, amountUsd: Math.round(totalUsd * 0.25), reason: "First-time contributors" },
      { category: "Emergency reserve", percent: 10, amountUsd: Math.round(totalUsd * 0.1), reason: "Crisis response" },
    ];
  }

  // Default OSS / founder / DAO allocation
  const maintainerPct = hasMaintainerRisk ? 40 : 30;
  const docsPct = 20;
  const moderationPct = mode === "dao" ? 15 : 10;
  const grantsPct = 15;
  const infraPct = hasFundingGap ? 10 : 15;
  const reservePct = 100 - maintainerPct - docsPct - moderationPct - grantsPct - infraPct;

  base.push(
    { category: "Maintainers", percent: maintainerPct, amountUsd: Math.round((maintainerPct / 100) * totalUsd), reason: hasMaintainerRisk ? "Ecosystem loses more maintainers than contributors" : "Core sustainers carry disproportionate load" },
    { category: "Documentation", percent: docsPct, amountUsd: Math.round((docsPct / 100) * totalUsd), reason: "Documentation debt increases onboarding friction" },
    { category: "Moderation & community", percent: moderationPct, amountUsd: Math.round((moderationPct / 100) * totalUsd), reason: "Community health prevents contributor churn" },
    { category: "Ecosystem grants", percent: grantsPct, amountUsd: Math.round((grantsPct / 100) * totalUsd), reason: "Peripheral projects extend reach" },
    { category: "Infrastructure", percent: infraPct, amountUsd: Math.round((infraPct / 100) * totalUsd), reason: "CI, hosting, and tooling sustain velocity" },
  );
  if (reservePct > 0) {
    base.push({ category: "Emergency reserve", percent: reservePct, amountUsd: Math.round((reservePct / 100) * totalUsd), reason: "Buffer for unexpected maintainer departures" });
  }
  return base;
}

export function buildCapitalBlueprint(ctx: OrchestratorContext): CapitalBlueprint | undefined {
  const totalUsd = ctx.capitalUsd;
  if (!totalUsd || totalUsd <= 0) return undefined;

  const scope = ctx.communityName ?? ctx.community.name ?? ctx.community.kindLabel;
  const distribution = defaultAllocations(ctx, totalUsd);
  const confidence = ctx.findings[0]?.confidence ?? 0.88;

  const isStreaming = /\b(stream|monthly|recurring|every block)\b/i.test(ctx.question);
  const isMilestone = /\b(milestone|verification|merged|PR)\b/i.test(ctx.question);
  const isRetro = /\b(retro|retroactive|after work)\b/i.test(ctx.question);

  const mechanism = isStreaming ? "Streaming" : isMilestone ? "Milestone" : isRetro ? "Retroactive" : "Monthly grants";
  const frequency = isStreaming ? "Continuous" : isMilestone ? "On verification" : "Monthly";

  return {
    title: `Fund ${scope}`,
    community: scope,
    totalCapitalUsd: totalUsd,
    duration: /\b(annual|year)\b/i.test(ctx.question) ? "12 months" : /\b(quarter)\b/i.test(ctx.question) ? "3 months" : "12 months",
    distribution,
    recipients: [
      "Maintainers",
      "Documentation contributors",
      "Community moderators",
      ...(ctx.community.kind === "music" ? ["Artists", "Producers"] : []),
      ...(ctx.community.kind === "research" ? ["Researchers", "Graduate students"] : []),
      "Infrastructure providers",
    ],
    flows: [
      {
        mechanism,
        frequency,
        verification: isMilestone ? "Merged work + community voting" : "Usage metrics + maintainer attestation",
        settlement: "USDC via Arc",
      },
    ],
    reservePercent: distribution.find((d) => d.category.includes("reserve"))?.percent ?? 5,
    confidence,
    rationale: ctx.findings[0]?.insight ?? `Evidence-backed allocation for ${scope} based on observed funding gaps and maintainer risk.`,
    rebalanceTriggers: [
      "Maintainer churn exceeds 2 departures per quarter",
      "Funding gap closes for a category",
      "New critical dependency emerges",
    ],
    successMetrics: [
      "Maintainer retention rate",
      "Contributor growth",
      "Documentation coverage",
      "Time-to-first-contribution for newcomers",
    ],
    stopConditions: [
      "Treasury depleted below reserve threshold",
      "Community self-sustains without external capital",
      "Governance vote to redirect funds",
    ],
  };
}

/** Domain-aware contextual pills — shown only when relevant. */
export function contextualMissionActions(input: {
  job: MissionJob;
  mode: OperatingMode;
  capability: CapabilityId;
  communityKind: CommunityKind;
  communityName?: string;
  capitalUsd?: number;
  hasBlueprint?: boolean;
  hasOpportunities: boolean;
  loopPhase: CapitalLoopPhase;
}): CapabilityAction[] {
  const scope = input.communityName ?? "this community";
  const actions: CapabilityAction[] = [];

  if (input.job === "understand") {
    actions.push(
      { id: "health", label: "Ecosystem health", prompt: `How healthy is ${scope}? Contributors, maintainers, treasury, governance, funding.`, kind: "explore" },
      { id: "deps", label: "Dependency map", prompt: `Map dependency exposure and downstream risk in ${scope}.`, kind: "explore" },
      { id: "gov", label: "Governance", prompt: `How does governance work in ${scope}? Who decides funding?`, kind: "explore" },
      { id: "fund-hist", label: "Funding history", prompt: `What is the funding history for ${scope}? Open Collective, grants, sponsorships.`, kind: "explore" },
    );
    if (input.hasOpportunities) {
      actions.push({ id: "to-design", label: "Design capital", prompt: `We have capital to deploy — design a funding policy for ${scope}.`, kind: "plan" });
    }
  }

  if (input.job === "design_capital") {
    const amt = input.capitalUsd ?? 50_000;
    actions.push(
      { id: "sim-50", label: "Simulate $50k", prompt: `Simulate allocating $50,000 in ${scope} — show distribution and impact.`, kind: "simulate" },
      { id: "sim-500", label: "Simulate $500k", prompt: `Simulate allocating $500,000 in ${scope} — show distribution and impact.`, kind: "simulate" },
      { id: "compare-pol", label: "Compare policies", prompt: "Compare Sustain Core vs Grow Ecosystem vs Balanced allocation philosophies.", kind: "explore" },
      { id: "grant-prog", label: "Build grant program", prompt: `Design a grant program for ${scope} — eligibility, amounts, verification.`, kind: "plan" },
    );
    if (input.hasBlueprint) {
      actions.push({ id: "blueprint", label: "Capital Blueprint", prompt: `Generate a complete Capital Blueprint for ${scope} with $${amt.toLocaleString()}.`, kind: "plan" });
    }
    actions.push({ id: "forecast", label: "Forecast impact", prompt: `Forecast ecosystem impact if we deploy $${amt.toLocaleString()} using this policy.`, kind: "simulate" });
  }

  if (input.job === "execute") {
    actions.push(
      { id: "dist-plan", label: "Create distribution plan", prompt: `Create a distribution plan for ${scope} — recipients, amounts, schedule.`, kind: "plan" },
      { id: "dao-prop", label: "Draft DAO proposal", prompt: `Draft a DAO treasury proposal for funding ${scope}.`, kind: "plan" },
      { id: "budget", label: "Generate budget", prompt: `Generate a detailed budget breakdown for ${scope} funding.`, kind: "plan" },
      { id: "settle", label: "Prepare settlement", prompt: "Walk me through exactly what capital would move and who receives it.", kind: "execute" },
    );
  }

  // Mode-specific additions
  if (input.mode === "creator") {
    actions.push({ id: "royalties", label: "Per-listen royalties", prompt: `Design per-listen royalty flow for creators in ${scope}.`, kind: "plan" });
  }
  if (input.mode === "research") {
    actions.push(
      { id: "academic", label: "Search academic", prompt: `Search academic literature and citations for ${scope}.`, kind: "explore" },
      { id: "grants", label: "Find grant gaps", prompt: `Which research groups in ${scope} lack grant funding?`, kind: "explore" },
    );
  }
  if (input.mode === "maintainer") {
    actions.push({ id: "burnout", label: "Burnout risk", prompt: `Assess maintainer burnout and bus-factor risk in ${scope}.`, kind: "explore" });
  }

  // Universal follow-ups
  actions.push(
    { id: "save", label: "Save to knowledge", prompt: "Save this mission analysis to knowledge base.", kind: "remember" },
    { id: "who-fund", label: "Who deserves funding?", prompt: `Who deserves funding in ${scope} based on observed impact?`, kind: "explore" },
  );

  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  }).slice(0, 6);
}

/** Amount / depth / philosophy pills after community question — Elsa-style. */
export function designCapitalSetupPills(communityName?: string): CapabilityAction[] {
  const scope = communityName ?? "this community";
  return [
    { id: "amt-50k", label: "$50k", prompt: `Design a $50,000 funding policy for ${scope}.`, kind: "plan" },
    { id: "amt-500k", label: "$500k", prompt: `Design a $500,000 funding policy for ${scope}.`, kind: "plan" },
    { id: "amt-2m", label: "$2M", prompt: `Design a $2,000,000 ecosystem funding policy for ${scope}.`, kind: "plan" },
    { id: "depth-deep", label: "Deep research", prompt: `Research ${scope} in depth — maintainers, grants, citations, treasury.`, kind: "explore" },
    { id: "phil-sustain", label: "Sustain core", prompt: `Design a Sustain Core policy for ${scope} — protect maintainers first.`, kind: "plan" },
    { id: "phil-grow", label: "Grow ecosystem", prompt: `Design a Grow Ecosystem policy for ${scope} — expand contributors.`, kind: "plan" },
  ];
}
