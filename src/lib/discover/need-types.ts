import type { DiscoverAction, TrendingValueGap } from "@/lib/discover/types";

/** Cross-cutting opportunity need — orthogonal to domain (oss/music/dao/research). */
export type DiscoverNeedType =
  | "funding"
  | "reviewers"
  | "translators"
  | "docs"
  | "moderators"
  | "artists"
  | "researchers"
  | "grants"
  | "automation";

export type DiscoverNeedTypeFilter = DiscoverNeedType | "all";

export const DISCOVER_NEED_TYPES: {
  id: DiscoverNeedType;
  label: string;
  hint: string;
}[] = [
  { id: "funding", label: "Funding", hint: "Capital gaps and fulfillment queues" },
  { id: "docs", label: "Docs", hint: "Documentation bounties · RFB #3" },
  { id: "reviewers", label: "Reviewers", hint: "Security review and CVE response · RFB #4" },
  { id: "translators", label: "Translators", hint: "i18n and localization contributors" },
  { id: "moderators", label: "Moderators", hint: "Community ops and governance" },
  { id: "artists", label: "Artists", hint: "Royalties and listen-proof · RFB #7" },
  { id: "researchers", label: "Researchers", hint: "Citations and OpenAlex · RFB #2" },
  { id: "grants", label: "Grants", hint: "Quadratic funding pools · RFB #6" },
  { id: "automation", label: "Automation", hint: "Agent signals and x402 rails" },
];

const TRANSLATION_HINTS = /\b(i18n|l10n|locale|translat|localization|international)\b/i;
const MODERATOR_HINTS = /\b(moderat|governance|community ops|steward)\b/i;
const SECURITY_HINTS = /\b(security|cve|advisory|vulnerab|patch review)\b/i;

const TEMPLATE_NEED: Record<string, DiscoverNeedType> = {
  "docs-bounty": "docs",
  "security-fund": "reviewers",
  "user-centric-royalties": "artists",
  "video-royalties": "artists",
  "citation-toll": "researchers",
  "quadratic-funding": "grants",
};

const AGENT_SERVICE_BY_NEED: Partial<Record<DiscoverNeedType, string>> = {
  docs: "docs-merge",
  researchers: "citation-toll",
  artists: "play-attribution",
  automation: "sentiment-per-request",
};

const NEED_BADGE_CLASS: Record<DiscoverNeedType, string> = {
  funding: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  docs: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  reviewers: "border-rose-500/30 bg-rose-500/10 text-rose-100",
  translators: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  moderators: "border-violet-500/30 bg-violet-500/10 text-violet-100",
  artists: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  researchers: "border-indigo-500/30 bg-indigo-500/10 text-indigo-100",
  grants: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-100",
  automation: "border-resolve-calm-periwinkle/30 bg-resolve-calm-periwinkle/10 text-resolve-calm-periwinkle",
};

export function needTypeLabel(needType: DiscoverNeedType): string {
  return DISCOVER_NEED_TYPES.find((n) => n.id === needType)?.label ?? needType;
}

export function needTypeBadgeClass(needType: DiscoverNeedType): string {
  return NEED_BADGE_CLASS[needType];
}

export function needTypeFromTemplateId(templateId?: string): DiscoverNeedType | null {
  if (!templateId) return null;
  return TEMPLATE_NEED[templateId] ?? null;
}

type ClassifyInput = {
  domain?: TrendingValueGap["domain"];
  templateId?: string;
  connectorId?: string;
  headline?: string;
  why?: string;
  boardKind?: "program" | "community";
  metricKind?: string;
};

export function classifyNeedType(input: ClassifyInput): DiscoverNeedType {
  if (input.connectorId === "agent_x402") return "automation";

  const fromTemplate = needTypeFromTemplateId(input.templateId);
  if (fromTemplate) return fromTemplate;

  const text = `${input.headline ?? ""} ${input.why ?? ""}`;
  if (SECURITY_HINTS.test(text)) return "reviewers";
  if (TRANSLATION_HINTS.test(text)) return "translators";
  if (MODERATOR_HINTS.test(text)) return "moderators";

  if (input.domain === "music") return "artists";
  if (input.domain === "research") return "researchers";
  if (input.domain === "dao" || input.templateId === "quadratic-funding") return "grants";

  if (input.boardKind === "community" && input.metricKind === "connect") {
    if (input.templateId?.includes("royalt")) return "artists";
    return "moderators";
  }

  if (input.domain === "oss" && input.templateId === "docs-bounty") return "docs";

  return "funding";
}

function primaryCtaLabel(needType: DiscoverNeedType, action: DiscoverAction): string {
  const map: Partial<Record<DiscoverNeedType, Partial<Record<DiscoverAction["kind"], string>>>> = {
    funding: { fund: "Fund gap", sponsor: "Sponsor program" },
    docs: { create_program: "Launch docs bounty", fund: "Fund docs program" },
    reviewers: { create_program: "Fund security reviewers", fund: "Fund security pool" },
    translators: { create_program: "Launch translation bounty", open: "Open locale board" },
    moderators: { connect_sensor: "Connect community", create_program: "Launch steward pool" },
    artists: { claim: "Claim artist royalties", fund: "Fund royalty pool" },
    researchers: { fund: "Fund citations", connect_sensor: "Connect OpenAlex" },
    grants: { fund: "Fund grant pool", create_program: "Launch QF round" },
    automation: { analyze: "Authorize agent signal", connect_sensor: "Connect sensor rail" },
  };
  return map[needType]?.[action.kind] ?? action.label;
}

function automationAction(needType: DiscoverNeedType, gap: TrendingValueGap): DiscoverAction | null {
  const serviceId = AGENT_SERVICE_BY_NEED[needType];
  if (!serviceId) return null;
  return {
    id: `agent-${serviceId}`,
    label: needType === "automation" ? "Authorize signal" : "Run agent rail",
    kind: "analyze",
    href: `/mission#signal-rails`,
    communitySlug: gap.communitySlug,
    templateId: gap.templateId,
    serviceId,
  };
}

function reorderActionsForNeedType(
  needType: DiscoverNeedType,
  actions: DiscoverAction[],
  gap: TrendingValueGap,
): DiscoverAction[] {
  const priority: Partial<Record<DiscoverNeedType, DiscoverAction["kind"][]>> = {
    funding: ["fund", "sponsor", "create_program"],
    docs: ["create_program", "fund", "connect_sensor"],
    reviewers: ["create_program", "fund", "connect_sensor"],
    translators: ["create_program", "open", "fund"],
    moderators: ["connect_sensor", "create_program", "open"],
    artists: ["claim", "fund", "create_program"],
    researchers: ["fund", "connect_sensor", "open"],
    grants: ["fund", "create_program", "sponsor"],
    automation: ["analyze", "connect_sensor", "fund"],
  };

  const order = priority[needType] ?? ["fund", "create_program", "open"];
  const labeled = actions.map((a) => ({
    ...a,
    label: primaryCtaLabel(needType, a),
  }));

  const agent = automationAction(needType, gap);
  const merged = agent ? [agent, ...labeled] : labeled;

  const seen = new Set<string>();
  const sorted: DiscoverAction[] = [];
  for (const kind of order) {
    for (const a of merged) {
      const key = `${a.kind}:${a.id}`;
      if (a.kind === kind && !seen.has(key)) {
        seen.add(key);
        sorted.push(a);
      }
    }
  }
  for (const a of merged) {
    const key = `${a.kind}:${a.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      sorted.push(a);
    }
  }
  return sorted;
}

function refineCopyForNeedType(gap: TrendingValueGap, needType: DiscoverNeedType): TrendingValueGap {
  const baseHeadline = gap.headline.replace(/\s*—\s*ecosystem gap$/i, "");
  const copy: Partial<
    Record<DiscoverNeedType, { headline: string; why: string }>
  > = {
    docs: {
      headline: `${baseHeadline} — needs documentation`,
      why: gap.amountVerified
        ? gap.why
        : "Merged docs PRs unlock maintainer value · RFB #3 docs bounty",
    },
    reviewers: {
      headline: `${baseHeadline} — needs security reviewers`,
      why: "CVE triage and patch review retainers · RFB #4 security fund",
    },
    translators: {
      headline: `${baseHeadline} — needs translators`,
      why: "Locale coverage and i18n contributors — fund translation bounties",
    },
    moderators: {
      headline: `${baseHeadline} — needs community stewards`,
      why: "Governance and moderation capacity — connect sensors and programs",
    },
    artists: {
      headline: gap.domain === "music" ? gap.headline : `${baseHeadline} — artist royalties`,
      why: gap.why.includes("authorization") ? gap.why : "Verified plays and credits · RFB #7 royalty pool",
    },
    researchers: {
      headline: gap.domain === "research" ? gap.headline : `${baseHeadline} — research citations`,
      why: gap.why.includes("Citation") || gap.why.includes("citation")
        ? gap.why
        : "OpenAlex / Crossref signals · RFB #2 citation toll",
    },
    grants: {
      headline: gap.headline.includes("grant") ? gap.headline : `${baseHeadline} — grant pool`,
      why: gap.why.includes("quadratic") || gap.why.includes("QF")
        ? gap.why
        : "Quadratic funding amplifies small donors · RFB #6",
    },
    automation: {
      headline: `${baseHeadline} — agent automation`,
      why: "Pay-per-signal on Arc — authorize agent rails instead of manual fulfillment",
    },
    funding: {
      headline: gap.headline,
      why: gap.why,
    },
  };

  const refined = copy[needType];
  if (!refined) return gap;
  return { ...gap, headline: refined.headline, why: refined.why };
}

/** Classify, refine copy, and reorder CTAs for a gap card. */
export function enrichGapWithNeedType(gap: TrendingValueGap): TrendingValueGap {
  const needType = classifyNeedType({
    domain: gap.domain,
    templateId: gap.templateId,
    connectorId: gap.proofConnectorId,
    headline: gap.headline,
    why: gap.why,
  });

  const withCopy = refineCopyForNeedType(gap, needType);
  return {
    ...withCopy,
    needType,
    actions: reorderActionsForNeedType(needType, withCopy.actions, withCopy),
  };
}

export function filterGapsByNeedType<T extends { needType?: DiscoverNeedType }>(
  gaps: T[],
  filter: DiscoverNeedTypeFilter,
): T[] {
  if (filter === "all") return gaps;
  return gaps.filter((g) => g.needType === filter);
}

export function classifyBoardNeedType(input: {
  templateId: string;
  communitySlug?: string;
  boardKind: "program" | "community";
  metricKind?: string;
  whyFund?: string;
  programName?: string;
}): DiscoverNeedType {
  const domain =
    input.templateId === "user-centric-royalties" || input.templateId === "video-royalties"
      ? ("music" as const)
      : input.templateId === "citation-toll"
        ? ("research" as const)
        : input.templateId === "quadratic-funding"
          ? ("dao" as const)
          : ("community" as const);

  return classifyNeedType({
    domain,
    templateId: input.templateId,
    headline: input.programName,
    why: input.whyFund,
    boardKind: input.boardKind,
    metricKind: input.metricKind,
  });
}

export function primaryBoardCtaLabel(
  needType: DiscoverNeedType,
  item: {
    boardKind: "program" | "community";
    templateId: string;
    connectCta?: string;
  },
): string {
  if (item.boardKind === "community") {
    const connect: Partial<Record<DiscoverNeedType, string>> = {
      artists: "Connect music sensor",
      researchers: "Connect research sensor",
      docs: "Connect GitHub for docs",
      moderators: "Connect community ops",
      grants: "Connect treasury",
      automation: "Connect agent rail",
    };
    return connect[needType] ?? item.connectCta ?? "Connect sensor";
  }

  const fund: Partial<Record<DiscoverNeedType, string>> = {
    docs: "Fund docs bounty",
    reviewers: "Fund security reviewers",
    grants: "Fund grant pool",
    artists: "Fund royalty pool",
    researchers: "Fund citation pool",
    translators: "Fund translation bounty",
    moderators: "Fund steward pool",
    automation: "Authorize signal",
    funding: "Fulfill program",
  };
  if (item.templateId === "quadratic-funding") return "Fund grant pool";
  return fund[needType] ?? "Fund program";
}
