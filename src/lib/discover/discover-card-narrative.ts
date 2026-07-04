import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";
import { formatDiscoverMoney } from "@/lib/discover/money-display";
import type { OpportunityState } from "@/lib/discover/discover-opportunity-state";
import type { DiscoverCardLane, TrendingValueGap } from "@/lib/discover/types";

export type DiscoverCardNarrative = {
  evidence: string;
  problem: string;
  opportunity: string;
  opportunityAmount: string;
  opportunityTone: "verified" | "estimate" | "not_synced" | "zero";
  valueLabel: string;
  valueText: string;
  countLabel: string;
  countText: string;
  confidenceText: string;
  blockerText: string;
  updatedText: string;
  primarySubtext: string;
};

function missingProgramLabel(gap: TrendingValueGap): string {
  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  if (gap.templateId === "video-royalties") return "pay-per-minute rule";
  if (gap.templateId === "user-centric-royalties") return "royalty pool";
  if (gap.templateId === "citation-toll") return "citation toll";
  if (gap.templateId === "quadratic-funding") return "grant pool";
  if (gap.templateId === "security-fund") return "security fund";
  if (gap.templateId === "docs-bounty") return "docs program";
  if (profile?.product) return `payout rule for ${profile.product}`;
  return "payout rule";
}

function domainPeopleLabel(gap: TrendingValueGap, count: number): string {
  if (gap.domain === "music") return count === 1 ? "artist" : "artists";
  if (gap.domain === "research") return count === 1 ? "author" : "authors";
  if (gap.templateId === "video-royalties") return count === 1 ? "creator" : "creators";
  if (gap.domain === "oss") return count === 1 ? "contributor" : "contributors";
  if (gap.domain === "dao") return count === 1 ? "member" : "members";
  return count === 1 ? "person" : "people";
}

function observedActivity(gap: TrendingValueGap): string | null {
  const observed = gap.valueMetrics?.observedEvents?.trim();
  if (!observed || observed === "Source not connected" || observed === "Needed") return null;
  return observed;
}

function valueLabelForGap(gap: TrendingValueGap): string {
  if (gap.valueMetrics?.valueLabel) return gap.valueMetrics.valueLabel;
  if (gap.amountVerified) return "Authorized value";
  if (gap.amountKind === "estimate" || gap.amountNeededUsd > 0 || gap.moneyCanMoveUsd > 0) {
    if (gap.domain === "music") return "Estimated royalties";
    if (gap.templateId === "video-royalties") return "Estimated creator rewards";
    if (gap.domain === "research") return "Estimated funding need";
    return "Estimated unpaid value";
  }
  return "Estimate unavailable";
}

function countLabelForGap(gap: TrendingValueGap): string {
  if (gap.valueMetrics?.countLabel) return gap.valueMetrics.countLabel;
  if (gap.domain === "music") return "Artists affected";
  if (gap.templateId === "video-royalties") return "Creators affected";
  if (gap.domain === "research") return "Authors affected";
  if (gap.templateId === "security-fund") return "Maintainers affected";
  if (gap.domain === "oss") return "Contributors affected";
  return "People affected";
}

function confidenceForGap(gap: TrendingValueGap): number {
  if (typeof gap.valueMetrics?.confidence === "number") return gap.valueMetrics.confidence;
  return (
    gap.opportunityScorecard?.chips.find((chip) => chip.dimension === "confidence")?.value ??
    (gap.amountVerified ? 96 : gap.amountNeededUsd > 0 ? 82 : 0)
  );
}

function evidenceLine(
  gap: TrendingValueGap,
  lane: DiscoverCardLane,
  proofSource: string,
  connected: boolean,
): string {
  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  const observed = observedActivity(gap);

  if (lane === "radars" && profile?.liveSignalTitle && connected) {
    if (gap.domain === "oss") return `${proofSource} is showing fresh PRs, docs work, commits, or security fixes.`;
    if (gap.domain === "music") return `${proofSource} is showing fresh plays, scrobbles, and artist attribution.`;
    if (gap.templateId === "video-royalties") return `${proofSource} is showing watch minutes and playback events.`;
    if (gap.domain === "research") return `${proofSource} is showing citations, DOI records, and author proof.`;
    return `${proofSource} is showing ${profile.liveSignalTitle.toLowerCase()}.`;
  }

  if (observed) {
    if (gap.domain === "oss") return `${proofSource} found ${observed.toLowerCase()}.`;
    if (gap.domain === "music") return `${proofSource} mapped ${observed.toLowerCase()} to artist attribution.`;
    if (gap.templateId === "video-royalties") return `${proofSource} verified ${observed.toLowerCase()} from playback events.`;
    if (gap.domain === "research") return `${proofSource} detected ${observed.toLowerCase()} across papers and authors.`;
    return `${proofSource} verified ${observed.toLowerCase()}.`;
  }

  if (profile?.unpaidSubtitle && !connected) {
    return profile.unpaidSubtitle;
  }

  if (gap.why?.trim()) return gap.why.trim();

  const sources = profile?.extractionSources?.join(" + ") ?? proofSource;
  if (connected) {
    if (gap.domain === "oss") return `${sources} verified upstream work - payout programs are not wired yet.`;
    if (gap.domain === "music") return `${sources} verified upstream listening - royalty payouts are not wired yet.`;
    if (gap.templateId === "video-royalties") return `${sources} verified playback activity - creator payouts are not wired yet.`;
    if (gap.domain === "research") return `${sources} verified citation activity - author payouts are not wired yet.`;
    return `${sources} verified upstream activity - economics are not wired yet.`;
  }
  return `Connect ${sources.split(" + ")[0] ?? "source"} in Profile so RESOLVE can ingest proof.`;
}

function missingProgramProblem(gap: TrendingValueGap, lane: DiscoverCardLane, program: string): string {
  if (gap.valueMetrics?.story) return gap.valueMetrics.story;

  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  const product = profile?.product ?? gap.communitySlug?.replace(/-/g, " ") ?? "this community";
  const observed = observedActivity(gap);
  const people = gap.peopleImpacted;
  const peopleLabel = people > 0 ? `${people.toLocaleString()} ${domainPeopleLabel(gap, people)}` : null;

  if (gap.templateId === "docs-bounty") {
    return `${observed ?? "Documentation PRs and maintainer work"} are visible in ${product}, but no docs program is active.`;
  }

  if (gap.templateId === "security-fund") {
    return `${observed ?? "Security fixes and dependency work"} are visible in ${product}, but no security fund is active.`;
  }

  if (gap.templateId === "user-centric-royalties") {
    return `${observed ?? "Listening activity"} mapped to ${peopleLabel ?? "artists"}, but no royalty pool is distributing payouts.`;
  }

  if (gap.templateId === "video-royalties") {
    return `${observed ?? "Watch minutes"} are verified for ${product}, but no pay-per-minute rule is paying creators.`;
  }

  if (gap.templateId === "citation-toll") {
    return `${observed ?? "Citation activity"} is visible in research sources, but no citation toll is active.`;
  }

  if (gap.templateId === "quadratic-funding" || gap.domain === "dao") {
    return "Grant and governance activity is visible, but no reviewer payroll or QF match pool is configured.";
  }

  if (lane === "graph") {
    return `Capital is waiting for ${product}, but no ${program} exists yet.`;
  }

  return `Verified activity is visible, but no ${program} exists yet.`;
}

function problemLine(input: {
  gap: TrendingValueGap;
  lane: DiscoverCardLane;
  connected: boolean;
  hasRule: boolean;
  funded: boolean;
  settled: boolean;
  opportunityState: OpportunityState;
}): string {
  const { gap, lane, connected, hasRule, funded, settled, opportunityState } = input;
  const program = missingProgramLabel(gap);

  if (settled || opportunityState === "settled") {
    return "Obligations settled on Arc - share receipts or fund the next cycle.";
  }

  if (opportunityState === "claimable") {
    return "Verified earnings are ready - connect identity or claim on Capital.";
  }

  if (!connected) {
    return "Proof cannot flow until the matching source is connected in Profile.";
  }

  if (lane === "radars") {
    if (!hasRule) return missingProgramProblem(gap, lane, program);
    if (!funded) return "Payout rule exists but the pool is unfunded - payouts cannot deploy yet.";
    return "Live proof is ready - reward, automate, or run analysis before it ages out.";
  }

  if (lane === "graph") {
    if (!hasRule) return missingProgramProblem(gap, lane, program);
    if (!funded) return "Program pool is unfunded - obligations are queued but cannot settle on Arc.";
    return "Fund this gap or open the community console to operate payouts.";
  }

  if (!hasRule) return missingProgramProblem(gap, lane, program);
  if (!funded) return `${program.charAt(0).toUpperCase() + program.slice(1)} is active but unfunded - deploy is blocked.`;
  return "Pool is funded - approve payouts on Arc when obligations are ready.";
}

function opportunityLine(gap: TrendingValueGap, moneyLabel: string): string {
  const people = gap.peopleImpacted;
  const parts: string[] = [];

  if (moneyLabel && moneyLabel !== "Unpaid") {
    parts.push(`${valueLabelForGap(gap)}: ${moneyLabel}`);
  } else {
    parts.push("Estimate unavailable - connect or sync the proof source");
  }

  if (people > 0) {
    parts.push(`${people.toLocaleString()} ${domainPeopleLabel(gap, people)} affected`);
  } else if (gap.moneyCanMoveUsd > 0.01) {
    parts.push("Obligations ready to move on Arc");
  }

  return parts.join(" + ");
}

function countTextForGap(gap: TrendingValueGap): string {
  const count = gap.valueMetrics?.countValue ?? gap.peopleImpacted;
  if (!count) return "Sync required";
  return count.toLocaleString();
}

/** Evidence -> problem -> opportunity story for Discover cards. */
export function buildDiscoverCardNarrative(input: {
  gap: TrendingValueGap;
  lane: DiscoverCardLane;
  proofSource: string;
  connected: boolean;
  hasRule: boolean;
  funded: boolean;
  settled: boolean;
  opportunityState: OpportunityState;
}): DiscoverCardNarrative {
  const money = formatDiscoverMoney(
    input.gap.amountNeededUsd > 0 ? input.gap.amountNeededUsd : input.gap.moneyCanMoveUsd,
    input.gap.amountVerified,
    input.gap.dataSource,
    input.gap.amountKind,
  );

  return {
    evidence: evidenceLine(input.gap, input.lane, input.proofSource, input.connected),
    problem: problemLine(input),
    opportunity: opportunityLine(input.gap, money.label),
    opportunityAmount: money.label,
    opportunityTone: money.tone,
    valueLabel: valueLabelForGap(input.gap),
    valueText:
      money.label === "Unpaid"
        ? "Estimate unavailable"
        : money.label,
    countLabel: countLabelForGap(input.gap),
    countText: countTextForGap(input.gap),
    confidenceText: confidenceForGap(input.gap) > 0 ? `${confidenceForGap(input.gap)}%` : "Sync required",
    blockerText: input.gap.valueMetrics?.blocker ?? missingProgramLabel(input.gap),
    updatedText: input.gap.valueMetrics?.lastActivity ?? (input.gap.updatedAt ? "updated recently" : "sync required"),
    primarySubtext: input.gap.valueMetrics?.primarySubtext ?? "Continue in RESOLVE",
  };
}
