import type { ImpactSignal, ImpactSignalId } from "@/lib/weight/types";

const SIGNAL_META: Record<
  ImpactSignalId,
  { label: string; defaultWeight: number }
> = {
  engagement_depth: { label: "Engagement depth", defaultWeight: 0.22 },
  contribution_complexity: { label: "Contribution complexity", defaultWeight: 0.24 },
  consistency: { label: "Consistency", defaultWeight: 0.14 },
  community_endorsement: { label: "Community endorsement", defaultWeight: 0.12 },
  proof_integrity: { label: "Proof integrity", defaultWeight: 0.18 },
  reach_proxy: { label: "Reach proxy", defaultWeight: 0.08 },
  suspicion_penalty: { label: "Suspicion penalty", defaultWeight: -0.2 },
};

export function buildSignal(
  id: ImpactSignalId,
  score: number,
  rationale: string,
): ImpactSignal {
  const meta = SIGNAL_META[id];
  return {
    id,
    label: meta.label,
    weight: meta.defaultWeight,
    score: Math.max(0, Math.min(100, Math.round(score))),
    rationale,
  };
}

export function compositeScore(signals: ImpactSignal[]): number {
  let positive = 0;
  let penalty = 0;
  for (const s of signals) {
    if (s.weight < 0) {
      penalty += (s.score / 100) * Math.abs(s.weight);
    } else {
      positive += (s.score / 100) * s.weight;
    }
  }
  const raw = positive * 100 - penalty * 100;
  return Math.max(1, Math.min(100, Math.round(raw)));
}

export const METHODOLOGY_SIGNALS = Object.entries(SIGNAL_META).map(([id, meta]) => ({
  id,
  ...meta,
}));
