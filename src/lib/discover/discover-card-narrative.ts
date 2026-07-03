import { formatDiscoverMoney } from "@/lib/discover/money-display";
import { getCommunityValueProfile } from "@/lib/discover/community-value-profiles";
import type { OpportunityState } from "@/lib/discover/discover-opportunity-state";
import type { DiscoverCardLane } from "@/lib/discover/types";
import type { TrendingValueGap } from "@/lib/discover/types";

export type DiscoverCardNarrative = {
  evidence: string;
  problem: string;
  opportunity: string;
  opportunityAmount: string;
  opportunityTone: "verified" | "estimate" | "not_synced" | "zero";
};

function missingProgramLabel(gap: TrendingValueGap): string {
  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  if (gap.templateId === "video-royalties") return "pay-per-minute program";
  if (gap.templateId === "user-centric-royalties") return "royalty pool";
  if (gap.templateId === "citation-toll") return "citation toll program";
  if (gap.templateId === "quadratic-funding") return "grant pool";
  if (gap.templateId === "security-fund") return "security fund";
  if (gap.templateId === "docs-bounty") return "docs bounty program";
  if (profile?.product) return `reward program for ${profile.product}`;
  return "reward program";
}

function evidenceLine(
  gap: TrendingValueGap,
  lane: DiscoverCardLane,
  proofSource: string,
  connected: boolean,
): string {
  const profile = gap.communitySlug ? getCommunityValueProfile(gap.communitySlug) : null;
  const observed = gap.valueMetrics?.observedEvents;

  if (lane === "radars") {
    if (profile?.liveSignalTitle && connected) {
      return `${proofSource} — ${profile.liveSignalTitle.toLowerCase()} is arriving on the ledger now.`;
    }
    if (gap.why?.trim()) return gap.why.trim();
    return `${proofSource} detected verified activity — react while the signal is fresh.`;
  }

  if (observed && observed !== "Source not connected" && observed !== "Needed") {
    return `${proofSource} — ${observed.toLowerCase()}.`;
  }

  if (profile?.unpaidSubtitle && !connected) {
    return profile.unpaidSubtitle;
  }

  if (gap.why?.trim()) return gap.why.trim();

  const sources = profile?.extractionSources?.join(" · ") ?? proofSource;
  if (connected) {
    return `${sources} verified upstream activity — economics are not wired yet.`;
  }
  return `Connect ${sources.split(" · ")[0] ?? "source"} on Profile so RESOLVE can ingest proof.`;
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
    return "Obligations settled on Arc — share receipts or fund the next cycle.";
  }

  if (opportunityState === "claimable") {
    return "Verified earnings are ready — connect identity or claim on Capital.";
  }

  if (!connected) {
    return "Proof cannot flow until the matching source is connected in Profile.";
  }

  if (lane === "radars") {
    if (!hasRule) {
      return `New signal — no ${program} is active to reward this activity automatically.`;
    }
    if (!funded) {
      return "Program rule exists but the pool is unfunded — payouts cannot deploy yet.";
    }
    return "Live proof is ready — reward, automate, or run analysis before it ages out.";
  }

  if (lane === "graph") {
    if (!hasRule) {
      return `Money is blocked — no ${program} exists on this community yet.`;
    }
    if (!funded) {
      return "Program pool is unfunded — obligations are queued but cannot settle on Arc.";
    }
    return "Fund this gap or open the community console to operate payouts.";
  }

  // gaps — unpaid value
  if (!hasRule) {
    return `Verified work is happening. No ${program} exists — money cannot settle yet.`;
  }
  if (!funded) {
    return `${program.charAt(0).toUpperCase() + program.slice(1)} is active but unfunded — deploy is blocked.`;
  }
  return "Pool is funded — approve payouts on Arc when obligations are ready.";
}

function opportunityLine(gap: TrendingValueGap, moneyLabel: string): string {
  const people = gap.peopleImpacted;
  const parts: string[] = [];

  if (moneyLabel && moneyLabel !== "Unpaid") {
    parts.push(`${moneyLabel} potential impact`);
  } else {
    parts.push("Impact unlocks when proof and a reward rule connect");
  }

  if (people > 0) {
    parts.push(`${people.toLocaleString()} ${people === 1 ? "person" : "people"} affected`);
  } else if (gap.moneyCanMoveUsd > 0.01) {
    parts.push("Obligations ready to move on Arc");
  }

  return parts.join(" · ");
}

/** Evidence → problem → opportunity story for Discover cards. */
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
  };
}
