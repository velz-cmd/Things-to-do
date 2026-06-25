import { scanAllOpportunities, scanFundingOpportunity } from "@/lib/github/opportunities";
import type { HiddenBuilder } from "@/lib/weight/types";

function opportunityToBuilder(opp: Awaited<ReturnType<typeof scanFundingOpportunity>>): HiddenBuilder | null {
  if (!opp) return null;
  return {
    id: opp.id,
    name: `${opp.owner}/${opp.repo}`,
    role: opp.health.maintainerCount <= 1 ? "Underfunded maintainer team" : "High-value OSS",
    platform: "github",
    handle: opp.fullName,
    impactScore: opp.health.score,
    fundingReadiness: Math.min(95, opp.health.score + 5),
    unpaidUsdEstimate: opp.health.fundingGapUsd,
    headline: opp.headline,
    live: opp.live,
    signals: opp.health.signals.map((s) => ({
      label: s.label,
      value: s.value,
      severity:
        s.impact === "negative" ? ("high" as const) : s.impact === "positive" ? ("low" as const) : ("medium" as const),
    })),
  };
}

/** Scan a single repo into UVI builder cards. */
export async function scanGithubRepo(owner: string, repo: string) {
  const opp = await scanFundingOpportunity(owner, repo);
  const builder = opportunityToBuilder(opp);
  return {
    builders: builder ? [builder] : ([] as HiddenBuilder[]),
    repo: opp
      ? { stargazers_count: opp.stars, open_issues_count: 0, description: opp.headline }
      : null,
  };
}

/** Legacy UVI scan — maps GitHub opportunities to builder cards. */
export async function runLiveDiscoveryScan(): Promise<HiddenBuilder[]> {
  const opportunities = await scanAllOpportunities();
  return opportunities
    .map((opp) => opportunityToBuilder(opp))
    .filter((b): b is HiddenBuilder => b !== null)
    .sort((a, b) => b.impactScore - a.impactScore);
}
