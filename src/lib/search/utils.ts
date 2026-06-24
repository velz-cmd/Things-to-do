import type { SearchOptions, SearchResult } from "./types";

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export function isRateLimited(status: number): boolean {
  return status === 429;
}

export function isRetryable(status: number): boolean {
  return RETRYABLE.has(status);
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
  label: string,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(input, init);
      if (res.ok || !isRetryable(res.status) || attempt === 2) return res;
      const delay = 400 * 2 ** attempt;
      console.warn(`[search:${label}] retry ${attempt + 1} after HTTP ${res.status}`);
      await sleep(delay);
    } catch (e) {
      lastError = e;
      if (attempt === 2) throw e;
      await sleep(400 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} request failed`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    let path = parsed.pathname.replace(/\/$/, "");
    if (!path) path = "";
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export function dedupeResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const item of results) {
    const key = normalizeUrl(item.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function rankResults(results: SearchResult[], intent?: SearchOptions["intent"]): SearchResult[] {
  const scored = results.map((r) => ({
    ...r,
    score: (r.score ?? 0) + relevanceBoost(r.url, intent),
  }));
  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return scored;
}

function relevanceBoost(url: string, intent?: SearchOptions["intent"]): number {
  const lower = url.toLowerCase();
  let boost = 0;

  if (lower.includes("github.com")) boost += 100;
  if (lower.includes("/issues") || lower.includes("/pull")) boost += 40;
  if (lower.includes("docs.") || lower.includes("/docs") || lower.includes("readme")) boost += 50;
  if (lower.includes("opencollective") || lower.includes("github.com/sponsors")) boost += 45;

  if (intent === "github" && lower.includes("github.com")) boost += 80;
  if (intent === "maintainers" && (lower.includes("github.com") || lower.includes("contributor"))) boost += 60;
  if (intent === "funding" && (lower.includes("fund") || lower.includes("sponsor") || lower.includes("opencollective"))) boost += 70;
  if (intent === "docs" && (lower.includes("docs") || lower.includes("documentation"))) boost += 70;
  if (intent === "payments" && (lower.includes("stripe") || lower.includes("payment") || lower.includes("x402"))) boost += 50;
  if (intent === "issues" && lower.includes("github.com/issues")) boost += 90;

  return boost;
}

export function intentQuery(query: string, intent?: SearchOptions["intent"]): string {
  switch (intent) {
    case "github":
      return `${query} site:github.com`;
    case "maintainers":
      return `${query} open source maintainer contributors github`;
    case "funding":
      return `${query} funding sponsors opencollective github sponsors`;
    case "docs":
      return `${query} documentation official docs`;
    case "payments":
      return `${query} payment integration USDC stripe x402`;
    case "issues":
      return `${query} site:github.com/issues`;
    default:
      return query;
  }
}

export function intentDomains(intent?: SearchOptions["intent"]): string[] | undefined {
  if (intent === "github" || intent === "maintainers" || intent === "issues") {
    return ["github.com"];
  }
  return undefined;
}
