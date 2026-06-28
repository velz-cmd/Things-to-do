/**
 * Bayesian payee confidence — P(payee | evidence) from sensor signals.
 * Not a vanity score; inputs are explicit proof strength and corroboration.
 */

export type BayesianConfidenceInput = {
  /** Prior belief payee deserves recognition (default 0.5) */
  prior?: number;
  /** Sensor signal quality 0–1 */
  sensorQuality: number;
  /** Cryptographic / API proof strength 0–1 */
  proofStrength: number;
  /** Corroboration from independent sources 0–1 */
  corroboration?: number;
};

export type BayesianConfidenceResult = {
  confidence: number;
  evidence: string;
};

/** P(pay|e) ∝ P(e|pay) · P(pay) — normalized posterior in [0.05, 0.98] */
export function bayesianPayeeConfidence(
  input: BayesianConfidenceInput,
): BayesianConfidenceResult {
  const prior = input.prior ?? 0.5;
  const likelihood =
    input.sensorQuality * 0.4 +
    input.proofStrength * 0.35 +
    (input.corroboration ?? 0) * 0.25;
  const posterior = (likelihood * prior) / (likelihood * prior + (1 - likelihood) * (1 - prior));
  const confidence = Math.max(0.05, Math.min(0.98, posterior));

  return {
    confidence: Math.round(confidence * 1000) / 1000,
    evidence:
      confidence >= 0.85
        ? `P(pay|e) ≈ ${confidence.toFixed(2)} — strong sensor + proof corroboration`
        : confidence >= 0.65
          ? `P(pay|e) ≈ ${confidence.toFixed(2)} — moderate evidence; may need founder review`
          : `P(pay|e) ≈ ${confidence.toFixed(2)} — weak evidence; hold until more proof`,
  };
}
