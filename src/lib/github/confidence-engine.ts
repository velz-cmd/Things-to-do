import type { ConfidenceBundle, SettlementStatus, TrustTier } from "@/lib/evidence/types";

const SETTLEMENT_THRESHOLD = 0.72;
const REVIEW_THRESHOLD = 0.55;

/**
 * Confidence Engine — Stripe/Cloudflare-style risk scoring.
 * Never binary "bot/human". Never rejects on commits/day or AI-assisted code.
 */
export function evaluateConfidence(input: {
  complexity: number;
  collaboration: number;
  impact: number;
  identityConfidence: number;
  whitespaceOnly: boolean;
  merged: boolean;
}): ConfidenceBundle {
  const coherenceFlags: string[] = [];

  if (input.complexity >= 85 && input.collaboration <= 10) {
    coherenceFlags.push("High complexity without review discussion");
  }
  if (input.impact >= 80 && input.identityConfidence < 0.35) {
    coherenceFlags.push("High impact claim with low identity confidence");
  }
  if (input.whitespaceOnly && input.complexity > 60) {
    coherenceFlags.push("Complexity score inconsistent with diff size");
  }
  if (!input.merged) {
    coherenceFlags.push("PR not merged");
  }

  const identity = Math.min(0.98, input.identityConfidence);
  const contribution = Math.min(
    0.98,
    (input.complexity / 100) * 0.5 + (input.collaboration / 100) * 0.5,
  );
  const impact = Math.min(0.98, input.impact / 100);
  const evidenceQuality = Math.min(
    0.98,
    0.5 + (coherenceFlags.length === 0 ? 0.4 : coherenceFlags.length === 1 ? 0.2 : 0),
  );

  const settlement =
    identity * 0.25 +
    contribution * 0.3 +
    impact * 0.25 +
    evidenceQuality * 0.2 -
    coherenceFlags.length * 0.08;

  const settlementClamped = Math.max(0.1, Math.min(0.98, settlement));

  const tier = tierFromSignals(identity, settlementClamped, coherenceFlags);
  const status = settlementStatusFrom(tier, settlementClamped, coherenceFlags, input.merged);

  return {
    identity,
    contribution,
    impact,
    evidenceQuality,
    settlement: settlementClamped,
    tier,
    status,
    coherenceFlags,
  };
}

function tierFromSignals(
  identity: number,
  settlement: number,
  flags: string[],
): TrustTier {
  if (flags.includes("PR not merged")) return "unknown";
  if (settlement >= 0.85 && identity >= 0.7) return "verified";
  if (settlement >= 0.65 && identity >= 0.5) return "likely_verified";
  if (settlement < 0.35 && identity < 0.3 && flags.length >= 2) return "likely_sybil";
  if (settlement < 0.25 && flags.length >= 3) return "rejected";
  return "unknown";
}

function settlementStatusFrom(
  tier: TrustTier,
  settlement: number,
  flags: string[],
  merged: boolean,
): SettlementStatus {
  if (!merged) return "excluded";
  if (tier === "rejected" || tier === "likely_sybil") return "excluded";
  if (settlement >= SETTLEMENT_THRESHOLD && flags.length <= 1) return "auto_settle";
  if (settlement >= REVIEW_THRESHOLD || tier === "unknown") return "founder_review";
  return "hold";
}

export function trustTierLabel(tier: TrustTier): string {
  const labels: Record<TrustTier, string> = {
    verified: "Verified",
    likely_verified: "Likely verified",
    unknown: "Unknown — needs more evidence",
    likely_sybil: "Likely sybil — manual review",
    rejected: "Rejected — incoherent evidence",
  };
  return labels[tier];
}
