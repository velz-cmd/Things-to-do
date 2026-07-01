import { classifySentiment } from "./sentiment";

export type X402MicroResult = {
  service: string;
  priceUsd: number;
  billingUnit: string;
  input: string;
  summary: string;
  payload: Record<string, unknown>;
  generatedAt: string;
};

export type X402MicroDefinition = {
  id: string;
  priceUsd: number;
  billingUnit: string;
  description: string;
  run: (text: string) => X402MicroResult;
};

function clip(text: string, max = 500) {
  return text.trim().slice(0, max);
}

const CVE_PATTERN = /\bCVE-\d{4}-\d{4,7}\b/gi;
const DOI_PATTERN = /\b10\.\d{4,9}\/[^\s]+/i;
const ARXIV_PATTERN = /\barxiv:\d{4}\.\d{4,5}\b/i;

export const X402_MICRO_SERVICES: Record<string, X402MicroDefinition> = {
  sentiment: {
    id: "sentiment",
    priceUsd: 0.001,
    billingUnit: "request",
    description: "Classify feedback sentiment",
    run(text) {
      const input = clip(text) || "Neutral sample feedback.";
      const result = classifySentiment(input);
      return {
        service: "sentiment",
        priceUsd: 0.001,
        billingUnit: "request",
        input,
        summary: `Sentiment ${result.label} (${Math.round(result.score * 100)}% score)`,
        payload: {
          sentiment: result.label,
          score: result.score,
          confidence: result.confidence,
        },
        generatedAt: new Date().toISOString(),
      };
    },
  },
  "citation-verify": {
    id: "citation-verify",
    priceUsd: 0.003,
    billingUnit: "signal",
    description: "Verify citation identifiers in text",
    run(text) {
      const input = clip(text);
      const doi = input.match(DOI_PATTERN)?.[0] ?? null;
      const arxiv = input.match(ARXIV_PATTERN)?.[0] ?? null;
      const verified = Boolean(doi || arxiv);
      return {
        service: "citation-verify",
        priceUsd: 0.003,
        billingUnit: "signal",
        input,
        summary: verified
          ? `Citation identifier found${doi ? ` · DOI ${doi}` : ""}${arxiv ? ` · ${arxiv}` : ""}`
          : "No DOI or arXiv identifier detected — paste a citation line",
        payload: { verified, doi, arxiv, wordCount: input.split(/\s+/).filter(Boolean).length },
        generatedAt: new Date().toISOString(),
      };
    },
  },
  "docs-review": {
    id: "docs-review",
    priceUsd: 0.02,
    billingUnit: "signal",
    description: "Docs quality heuristics for PR snippets",
    run(text) {
      const input = clip(text, 2000);
      const words = input.split(/\s+/).filter(Boolean);
      const lines = input.split("\n").filter((l) => l.trim().length > 0);
      const hasCodeFence = /```/.test(input);
      const score = Math.min(
        100,
        Math.round(words.length / 4 + lines.length * 2 + (hasCodeFence ? 15 : 0)),
      );
      return {
        service: "docs-review",
        priceUsd: 0.02,
        billingUnit: "signal",
        input: clip(input),
        summary: `${words.length} words · ${lines.length} sections · quality score ${score}/100`,
        payload: { wordCount: words.length, sectionCount: lines.length, hasCodeFence, score },
        generatedAt: new Date().toISOString(),
      };
    },
  },
  attribution: {
    id: "attribution",
    priceUsd: 0.002,
    billingUnit: "signal",
    description: "Parse play/watch attribution from activity text",
    run(text) {
      const input = clip(text);
      const artistMatch = input.match(/(?:artist|by)[:\s]+([^·\n,|]+)/i);
      const trackMatch = input.match(/(?:track|title|song)[:\s]+([^·\n|]+)/i);
      const artist = artistMatch?.[1]?.trim() ?? null;
      const track = trackMatch?.[1]?.trim() ?? null;
      return {
        service: "attribution",
        priceUsd: 0.002,
        billingUnit: "signal",
        input,
        summary:
          artist || track
            ? `Attributed ${artist ?? "unknown artist"}${track ? ` — ${track}` : ""}`
            : "Include artist: and track: labels for attribution parse",
        payload: { artist, track, parseable: Boolean(artist || track) },
        generatedAt: new Date().toISOString(),
      };
    },
  },
  "security-signal": {
    id: "security-signal",
    priceUsd: 0.1,
    billingUnit: "signal",
    description: "Extract CVE and severity hints from advisory text",
    run(text) {
      const input = clip(text, 1500);
      const cves = [...input.matchAll(CVE_PATTERN)].map((m) => m[0].toUpperCase());
      const severity =
        /\bcritical\b/i.test(input)
          ? "critical"
          : /\bhigh\b/i.test(input)
            ? "high"
            : /\bmedium\b/i.test(input)
              ? "medium"
              : cves.length > 0
                ? "unknown"
                : "none";
      return {
        service: "security-signal",
        priceUsd: 0.1,
        billingUnit: "signal",
        input: clip(input),
        summary:
          cves.length > 0
            ? `${cves.length} CVE reference(s) · severity ${severity}`
            : "No CVE identifiers found — paste advisory text",
        payload: { cves, severity, advisoryLines: input.split("\n").filter(Boolean).length },
        generatedAt: new Date().toISOString(),
      };
    },
  },
};

export function runX402MicroService(serviceId: string, text: string): X402MicroResult | null {
  const def = X402_MICRO_SERVICES[serviceId];
  if (!def) return null;
  return def.run(text);
}

export function x402MicroSlugFromServiceId(serviceId: string): string | null {
  const map: Record<string, string> = {
    "sentiment-per-request": "sentiment",
    "citation-verify": "citation-verify",
    "docs-review": "docs-review",
    "attribution-signal": "attribution",
    "security-signal": "security-signal",
  };
  return map[serviceId] ?? null;
}
