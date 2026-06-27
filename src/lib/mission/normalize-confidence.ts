/** Findings use 0–100; brief/report use 0–1. Normalize to 0–1. */
export function normalizeConfidence(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 0.85;
  if (value > 1) return Math.min(1, value / 100);
  return Math.max(0, Math.min(1, value));
}

export function confidencePercent(value: number | undefined): number {
  return Math.round(normalizeConfidence(value) * 100);
}
