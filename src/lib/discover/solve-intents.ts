import type { TrendingValueGap } from "@/lib/discover/types";

/** A "Solve with AI" request routed to the Agent Signal Market. */
export type SolveIntent = {
  /** Agent Signal Market service id (see service-registry.ts) */
  serviceId: string;
  /** Founder-language prompt — "find who should be paid", not backend jargon */
  prompt: string;
  /** Short button label */
  label: string;
};

function subjectForGap(gap: TrendingValueGap): string {
  return (
    gap.communitySlug ??
    gap.productLabel ??
    gap.headline ??
    "this community"
  );
}

/**
 * Map a Discover opportunity to the right paid agent + a founder-language prompt.
 * Culminates the "Solve" workflow: problem → agent → recommendation → Approve.
 */
export function solveIntentForGap(gap: TrendingValueGap): SolveIntent {
  const subject = subjectForGap(gap);

  switch (gap.domain) {
    case "oss":
      return {
        serviceId: "docs-review",
        label: "Solve with AI",
        prompt: `Find missing contributors and unpaid docs/maintainer work for ${subject} — who deserves a payout and roughly how much?`,
      };
    case "music":
      return {
        serviceId: "attribution-signal",
        label: "Solve with AI",
        prompt: `Find unrewarded artists and verified plays for ${subject} — who should the royalty pool pay first?`,
      };
    case "research":
      return {
        serviceId: "citation-verify",
        label: "Solve with AI",
        prompt: `Find uncited or under-funded research for ${subject} — who deserves a citation-toll payout?`,
      };
    case "dao":
    case "community":
    case "protocol":
    default:
      return {
        serviceId: "premium-research",
        label: "Solve with AI",
        prompt: `Analyze ${subject}: where is value blocked, and who should be funded next? Return a ranked, fundable recommendation.`,
      };
  }
}
