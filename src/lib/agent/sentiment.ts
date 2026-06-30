/** Lightweight sentiment for x402 demo — no external API dependency. */

const POSITIVE = [
  "love",
  "great",
  "excellent",
  "amazing",
  "happy",
  "thanks",
  "thank",
  "wonderful",
  "fantastic",
  "good",
  "helpful",
  "satisfied",
];

const NEGATIVE = [
  "hate",
  "terrible",
  "awful",
  "bad",
  "angry",
  "frustrated",
  "disappointed",
  "broken",
  "slow",
  "refund",
  "worst",
  "unacceptable",
];

export type SentimentResult = {
  label: "positive" | "negative" | "neutral" | "mixed";
  score: number;
  confidence: number;
  tokens: number;
};

export function classifySentiment(text: string): SentimentResult {
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, " ");
  const words = normalized.split(/\s+/).filter(Boolean);
  let pos = 0;
  let neg = 0;
  for (const w of words) {
    if (POSITIVE.some((p) => w.includes(p))) pos++;
    if (NEGATIVE.some((n) => w.includes(n))) neg++;
  }
  const total = pos + neg;
  const score = total === 0 ? 0 : (pos - neg) / Math.max(total, 1);
  let label: SentimentResult["label"] = "neutral";
  if (pos > 0 && neg > 0) label = "mixed";
  else if (score > 0.2) label = "positive";
  else if (score < -0.2) label = "negative";

  return {
    label,
    score: Math.round(score * 100) / 100,
    confidence: Math.min(0.95, 0.5 + total * 0.08),
    tokens: words.length,
  };
}
