/**
 * Phase 4 creator-first distribution checks (no DB required for policy math).
 */
import {
  decayFactor,
  effectiveNotifySignal,
  evaluateNotifyCandidate,
  aggregateNotifyCandidate,
  NOTIFY_MIN_AMOUNT_USD,
  NOTIFY_MIN_CONFIDENCE,
} from "../src/lib/earn/notify-policy";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`OK: ${msg}`);
  }
}

const now = Date.now();
const fresh = new Date(now - 2 * 24 * 60 * 60 * 1000);
const stale = new Date(now - 60 * 24 * 60 * 60 * 1000);

assert(decayFactor(fresh) > 0.85, "fresh authorization retains high decay factor");
assert(decayFactor(stale) < 0.25, "stale authorization decays below quarter urgency");

const strong = evaluateNotifyCandidate({
  amountUsd: 25,
  confidence: 0.9,
  claimableSince: fresh,
});
assert(strong.notify, "strong fresh signal notifies");

const weakAmount = evaluateNotifyCandidate({
  amountUsd: 0.1,
  confidence: 0.95,
  claimableSince: fresh,
});
assert(!weakAmount.notify && weakAmount.reason === "below_min_amount", "low amount blocked");

const weakConfidence = evaluateNotifyCandidate({
  amountUsd: 10,
  confidence: 0.4,
  claimableSince: fresh,
});
assert(
  !weakConfidence.notify && weakConfidence.reason === "below_min_confidence",
  "low confidence blocked",
);

const staleSignal = evaluateNotifyCandidate({
  amountUsd: 2,
  confidence: 0.75,
  claimableSince: stale,
});
assert(
  !staleSignal.notify && staleSignal.reason === "stale_or_low_signal",
  "stale authorization drops below effective signal",
);

const grouped = aggregateNotifyCandidate([
  { amountUsd: 0.05, confidence: 0.9, claimableSince: fresh },
  { amountUsd: 0.05, confidence: 0.9, claimableSince: fresh },
]);
assert(grouped !== null && grouped.amountUsd === 0.1, "aggregates micro-authorizations");

const groupedDecision = grouped ? evaluateNotifyCandidate(grouped) : { notify: false };
assert(
  !groupedDecision.notify,
  "aggregated amount still below min threshold when under $0.50",
);

const groupedBig = aggregateNotifyCandidate([
  { amountUsd: 15, confidence: 0.88, claimableSince: fresh },
  { amountUsd: 10, confidence: 0.92, claimableSince: fresh },
]);
assert(groupedBig !== null, "groups substantial authorizations");
const bigDecision = groupedBig ? evaluateNotifyCandidate(groupedBig) : { notify: false };
assert(bigDecision.notify, "substantial grouped signal notifies");

assert(NOTIFY_MIN_AMOUNT_USD >= 0.5, "min amount threshold configured");
assert(NOTIFY_MIN_CONFIDENCE >= 0.65, "min confidence threshold configured");

const urgency = effectiveNotifySignal({
  amountUsd: 100,
  confidence: 0.9,
  claimableSince: fresh,
});
assert(urgency > 50, "effective signal scales with amount and confidence");

if (failed > 0) {
  console.error(`\n${failed} phase 4 check(s) failed`);
  process.exit(1);
}

console.log("\nAll phase 4 earn checks passed");
