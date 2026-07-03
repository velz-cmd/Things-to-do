import type { TrendingValueGap } from "@/lib/discover/types";

/** A Discover opportunity analysis request routed to Mission. */
export type SolveIntent = {
  serviceId: string;
  prompt: string;
  label: string;
};

function subjectForGap(gap: TrendingValueGap): string {
  return gap.communitySlug ?? gap.productLabel ?? gap.headline ?? "this community";
}

/** Map a Discover opportunity to a Mission prompt with concrete next steps. */
export function solveIntentForGap(gap: TrendingValueGap): SolveIntent {
  const subject = subjectForGap(gap);

  switch (gap.domain) {
    case "oss":
      return {
        serviceId: "docs-review",
        label: "Run contributor analysis",
        prompt: `Find missing contributors and unpaid docs/maintainer work for ${subject}. Recommend payout rules, contributors, and an initial funding amount.`,
      };
    case "music":
      return {
        serviceId: "attribution-signal",
        label: "Calculate revenue split",
        prompt: `Find unrewarded artists and verified plays for ${subject}. Recommend an attribution split and the first royalty pool to launch.`,
      };
    case "research":
      return {
        serviceId: "citation-verify",
        label: "Verify citations",
        prompt: `Verify citation activity for ${subject}. Recommend who should receive a citation-toll payout and what grant pool should launch first.`,
      };
    case "dao":
      return {
        serviceId: "premium-research",
        label: "Estimate reward pool",
        prompt: `Analyze ${subject}: estimate the reward pool, expected impact, and first grant round to launch.`,
      };
    case "community":
    case "protocol":
    default:
      return {
        serviceId: "premium-research",
        label: "Start analysis",
        prompt: `Analyze ${subject}: where is value blocked, what program should be created, and who should be funded next? Return a ranked, fundable recommendation.`,
      };
  }
}
