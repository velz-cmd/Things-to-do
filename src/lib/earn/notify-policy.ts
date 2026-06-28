/**
 * Creator-first notification policy — real urgency from ledger math, not cosmetic nudges.
 *
 * - Signal-to-noise: minimum amount and confidence before email
 * - Half-life decay: stale claimable authorizations lose effective urgency over time
 */

export const NOTIFY_MIN_AMOUNT_USD = 0.5;
export const NOTIFY_MIN_CONFIDENCE = 0.65;
/** Days until urgency halves (matches 14-day claim link TTL). */
export const NOTIFY_HALF_LIFE_DAYS = 14;
/** Minimum effective signal (amount × confidence × decay) to send email. */
export const NOTIFY_MIN_EFFECTIVE_SIGNAL = 0.35;

export type NotifyCandidate = {
  amountUsd: number;
  confidence: number;
  /** When the payee could first claim (fulfilledAt preferred). */
  claimableSince: Date;
};

export function decayFactor(
  claimableSince: Date,
  halfLifeDays = NOTIFY_HALF_LIFE_DAYS,
  now = Date.now(),
): number {
  const ageDays = Math.max(0, (now - claimableSince.getTime()) / (1000 * 60 * 60 * 24));
  return Math.pow(0.5, ageDays / halfLifeDays);
}

export function effectiveNotifySignal(
  candidate: NotifyCandidate,
  now = Date.now(),
): number {
  const amount = Math.round(candidate.amountUsd * 100) / 100;
  const confidence = Math.min(1, Math.max(0, candidate.confidence));
  return amount * confidence * decayFactor(candidate.claimableSince, NOTIFY_HALF_LIFE_DAYS, now);
}

export type NotifyDecision = {
  notify: boolean;
  urgency: number;
  decay: number;
  reason?: string;
};

export function evaluateNotifyCandidate(
  candidate: NotifyCandidate,
  now = Date.now(),
): NotifyDecision {
  const amount = Math.round(candidate.amountUsd * 100) / 100;
  const confidence = Math.min(1, Math.max(0, candidate.confidence));
  const decay = decayFactor(candidate.claimableSince, NOTIFY_HALF_LIFE_DAYS, now);
  const urgency = amount * confidence * decay;

  if (amount < NOTIFY_MIN_AMOUNT_USD) {
    return { notify: false, urgency, decay, reason: "below_min_amount" };
  }
  if (confidence < NOTIFY_MIN_CONFIDENCE) {
    return { notify: false, urgency, decay, reason: "below_min_confidence" };
  }
  if (urgency < NOTIFY_MIN_EFFECTIVE_SIGNAL) {
    return { notify: false, urgency, decay, reason: "stale_or_low_signal" };
  }

  return { notify: true, urgency, decay };
}

export function aggregateNotifyCandidate(
  rows: Array<{ amountUsd: number; confidence: number; claimableSince: Date }>,
): NotifyCandidate | null {
  if (!rows.length) return null;

  const amountUsd = rows.reduce((s, r) => s + r.amountUsd, 0);
  if (amountUsd <= 0) return null;

  const weightedConfidence =
    rows.reduce((s, r) => s + r.amountUsd * r.confidence, 0) / amountUsd;

  const claimableSince = rows.reduce(
    (oldest, r) => (r.claimableSince < oldest ? r.claimableSince : oldest),
    rows[0]!.claimableSince,
  );

  return {
    amountUsd: Math.round(amountUsd * 100) / 100,
    confidence: weightedConfidence,
    claimableSince,
  };
}
