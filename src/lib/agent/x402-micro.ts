import { classifySentiment } from "./sentiment";

export type X402MicroResult = {
  service: string;
  priceUsd: number;
  billingUnit: string;
  input: string;
  summary: string;
  payload: Record<string, unknown>;
  generatedAt: string;
  /** What the agent actually did — shown to the user */
  steps: string[];
  /** Concrete outputs the user can act on */
  findings: string[];
  recommendations: string[];
  deliverables: string[];
};

export type X402MicroDefinition = {
  id: string;
  priceUsd: number;
  billingUnit: string;
  description: string;
  deliverables: string[];
  run: (text: string) => X402MicroResult;
};

function baseResult(
  partial: Omit<X402MicroResult, "steps" | "findings" | "recommendations" | "deliverables"> & {
    steps?: string[];
    findings?: string[];
    recommendations?: string[];
    deliverables?: string[];
  },
): X402MicroResult {
  return {
    ...partial,
    steps: partial.steps ?? [],
    findings: partial.findings ?? [],
    recommendations: partial.recommendations ?? [],
    deliverables: partial.deliverables ?? [],
  };
}

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
    deliverables: ["Sentiment label", "Confidence score", "Classified text excerpt"],
    run(text) {
      const input = clip(text) || "Neutral sample feedback.";
      const result = classifySentiment(input);
      return baseResult({
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
        steps: [
          "Tokenized feedback text",
          "Scored positive / negative / neutral signals",
          "Returned label with confidence",
        ],
        findings: [
          `Classification: ${result.label}`,
          `Confidence ${Math.round(result.confidence * 100)}% on ${input.split(/\s+/).filter(Boolean).length} words`,
        ],
        recommendations:
          result.label === "negative"
            ? ["Route to maintainer response queue", "Pair with fund action if gap is funding-related"]
            : ["Archive as community health signal", "Use in quarterly contributor report"],
        deliverables: ["Sentiment label", "Confidence score", "Classified text excerpt"],
      });
    },
  },
  "citation-verify": {
    id: "citation-verify",
    priceUsd: 0.003,
    billingUnit: "signal",
    description: "Verify citation identifiers in text",
    deliverables: ["DOI / arXiv detection", "Verification status", "Citation parse"],
    run(text) {
      const input = clip(text);
      const doi = input.match(DOI_PATTERN)?.[0] ?? null;
      const arxiv = input.match(ARXIV_PATTERN)?.[0] ?? null;
      const verified = Boolean(doi || arxiv);
      return baseResult({
        service: "citation-verify",
        priceUsd: 0.003,
        billingUnit: "signal",
        input,
        summary: verified
          ? `Citation identifier found${doi ? ` · DOI ${doi}` : ""}${arxiv ? ` · ${arxiv}` : ""}`
          : "No DOI or arXiv identifier detected — paste a citation line",
        payload: { verified, doi, arxiv, wordCount: input.split(/\s+/).filter(Boolean).length },
        generatedAt: new Date().toISOString(),
        steps: [
          "Scanned text for DOI and arXiv patterns",
          verified ? "Matched at least one scholarly identifier" : "No identifiers matched",
        ],
        findings: verified
          ? [
              doi ? `DOI located: ${doi}` : "",
              arxiv ? `arXiv located: ${arxiv}` : "",
              "Identifier format passes basic validation",
            ].filter(Boolean)
          : ["No DOI or arXiv token found in input"],
        recommendations: verified
          ? ["Authorize citation toll on OpenAlex sensor when ingest confirms reuse"]
          : ["Paste a full citation line with DOI or arXiv ID", "Try: Verify citation 10.1038/nature12373 in …"],
        deliverables: ["DOI / arXiv detection", "Verification status", "Citation parse"],
      });
    },
  },
  "docs-review": {
    id: "docs-review",
    priceUsd: 0.02,
    billingUnit: "signal",
    description: "Docs quality heuristics for PR snippets",
    deliverables: [
      "Docs quality score (0–100)",
      "Structure analysis",
      "Maintainer program next steps",
    ],
    run(text) {
      const input = clip(text, 2000);
      const words = input.split(/\s+/).filter(Boolean);
      const lines = input.split("\n").filter((l) => l.trim().length > 0);
      const hasCodeFence = /```/.test(input);
      const mentionsMaintainers = /maintainer|contributor|react|docs?\s*gap|oss/i.test(input);
      const mentionsRepo = /[\w.-]+\/[\w.-]+/.test(input);
      const score = Math.min(
        100,
        Math.round(words.length / 4 + lines.length * 2 + (hasCodeFence ? 15 : 0)),
      );

      const findings: string[] = [
        `Analyzed briefing: ${words.length} words across ${lines.length} section(s)`,
        `Docs depth score: ${score}/100 (${score >= 60 ? "adequate structure" : "needs more detail"})`,
      ];
      const recommendations: string[] = [];
      const steps = [
        "Parsed prompt for OSS / maintainer / docs intent",
        "Ran heuristic structure scan (sections, code blocks, word depth)",
      ];

      if (mentionsMaintainers) {
        steps.push("Matched maintainer-intel pattern — mapped to docs-gap playbook");
        findings.push("Target: maintainer health & documentation gaps (OSS program)");
        if (!mentionsRepo) {
          findings.push("No owner/repo in prompt — live repo metrics not attached");
          recommendations.push("Add owner/repo (e.g. facebook/react) for repo-specific maintainer signals");
        } else {
          const repo = input.match(/[\w.-]+\/[\w.-]+/)?.[0];
          if (repo) findings.push(`Repo hint detected: ${repo} — connect GitHub sensor for live vitals`);
        }
        recommendations.push("Open Gaps lane for scored funding opportunities on this ecosystem");
        recommendations.push("Install docs-merge bounty program when PR sensor confirms merge");
      }

      if (words.length < 30) {
        findings.push("Briefing is thin — agent scored the prompt text only, not a full PR diff");
        recommendations.push("Paste a docs PR excerpt or migration guide snippet for file-level review");
      }
      if (hasCodeFence) findings.push("Code fence detected — examples included in briefing");

      return baseResult({
        service: "docs-review",
        priceUsd: 0.02,
        billingUnit: "signal",
        input: clip(input),
        summary:
          mentionsMaintainers
            ? `Maintainer docs intel · score ${score}/100 · ${words.length} words analyzed`
            : `${words.length} words · ${lines.length} sections · quality score ${score}/100`,
        payload: {
          wordCount: words.length,
          sectionCount: lines.length,
          hasCodeFence,
          score,
          maintainerIntel: mentionsMaintainers,
        },
        generatedAt: new Date().toISOString(),
        steps,
        findings,
        recommendations,
        deliverables: [
          "Docs quality score (0–100)",
          "Structure analysis",
          "Maintainer program next steps",
        ],
      });
    },
  },
  attribution: {
    id: "attribution",
    priceUsd: 0.002,
    billingUnit: "signal",
    description: "Parse play/watch attribution from activity text",
    deliverables: ["Artist parse", "Track parse", "Royalty routing hint"],
    run(text) {
      const input = clip(text);
      const artistMatch = input.match(/(?:artist|by)[:\s]+([^·\n,|]+)/i);
      const trackMatch = input.match(/(?:track|title|song)[:\s]+([^·\n|]+)/i);
      const artist = artistMatch?.[1]?.trim() ?? null;
      const track = trackMatch?.[1]?.trim() ?? null;
      const parseable = Boolean(artist || track);
      return baseResult({
        service: "attribution",
        priceUsd: 0.002,
        billingUnit: "signal",
        input,
        summary:
          artist || track
            ? `Attributed ${artist ?? "unknown artist"}${track ? ` — ${track}` : ""}`
            : "Include artist: and track: labels for attribution parse",
        payload: { artist, track, parseable },
        generatedAt: new Date().toISOString(),
        steps: [
          "Parsed activity text for artist:/track: labels",
          parseable ? "Extracted attribution fields" : "No labeled fields found",
        ],
        findings: parseable
          ? [`Artist: ${artist ?? "—"}`, `Track: ${track ?? "—"}`]
          : ["Could not extract artist or track from free text"],
        recommendations: parseable
          ? ["Route play attribution through ListenBrainz sensor on Communities"]
          : ['Use format: artist: Name · track: Title'],
        deliverables: ["Artist parse", "Track parse", "Royalty routing hint"],
      });
    },
  },
  "security-signal": {
    id: "security-signal",
    priceUsd: 0.1,
    billingUnit: "signal",
    description: "Extract CVE and severity hints from advisory text",
    deliverables: ["CVE list", "Severity estimate", "Advisory line count"],
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
      return baseResult({
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
        steps: [
          "Scanned advisory text for CVE tokens",
          `Classified severity hint: ${severity}`,
        ],
        findings:
          cves.length > 0
            ? cves.map((c) => `CVE matched: ${c}`)
            : ["No CVE identifiers in input"],
        recommendations:
          cves.length > 0
            ? ["Fund security patch program when maintainer confirms fix", "Open Board lane for scored OSS gaps"]
            : ["Paste full advisory with CVE-YYYY-NNNN identifiers"],
        deliverables: ["CVE list", "Severity estimate", "Advisory line count"],
      });
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
