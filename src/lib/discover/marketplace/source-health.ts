/**
 * Phase 1 corrective C: structured source-health state.
 *
 * sourceFailure() (query.ts) sanitizes one error into a clean user-facing
 * message - useful, but not itself a tracked state. This module is the
 * typed status layer: given when a source last succeeded and what just
 * happened, it classifies the source into one of four honest states and
 * carries the fields a marketplace record needs to say "Last confirmed 3h
 * ago" without ever exposing HTTP status codes or raw exception text.
 *
 * This is a pure classifier - it does not itself track history. Callers
 * supply lastSuccessfulRefreshAt from whatever durable observation they
 * already have (e.g. FundingOpportunity.adoption.observedAt,
 * FundingOpportunity.security.observedAt), so no new persistence is
 * required to use it.
 */

export type SourceHealthStatus = "healthy" | "stale" | "rate_limited" | "unavailable";

export type SourceHealthState = {
  status: SourceHealthStatus;
  /** ISO timestamp of the last confirmed successful observation, or null if none has ever occurred. */
  lastSuccessfulRefreshAt: string | null;
  /** ISO timestamp of the most recent attempt (successful or not). */
  lastAttemptAt: string;
  /** Sanitized, non-alarming reason - never raw HTTP/exception detail. */
  reason?: string;
};

/** Matches the existing 6h staleness convention used by oss-scan-store.ts's STALE_MS. */
const STALE_AFTER_MS = 6 * 60 * 60_000;
const UNAVAILABLE_AFTER_MS = 24 * 60 * 60_000;

export function classifySourceHealth(input: {
  lastSuccessfulRefreshAt: string | null;
  lastAttemptAt: string;
  lastAttemptSucceeded: boolean;
  rateLimited?: boolean;
  reason?: string;
}): SourceHealthState {
  const base = {
    lastSuccessfulRefreshAt: input.lastSuccessfulRefreshAt,
    lastAttemptAt: input.lastAttemptAt,
    reason: input.reason,
  };

  if (input.rateLimited) {
    return { ...base, status: "rate_limited" };
  }

  if (!input.lastSuccessfulRefreshAt) {
    return { ...base, status: "unavailable" };
  }

  if (input.lastAttemptSucceeded) {
    return { ...base, status: "healthy" };
  }

  const ageMs =
    new Date(input.lastAttemptAt).getTime() -
    new Date(input.lastSuccessfulRefreshAt).getTime();

  if (ageMs > UNAVAILABLE_AFTER_MS) {
    return { ...base, status: "unavailable" };
  }
  if (ageMs > STALE_AFTER_MS) {
    return { ...base, status: "stale" };
  }
  // A single failed attempt shortly after a confirmed success is still
  // "healthy" from the user's point of view - the confirmed value is
  // fresh, even though the most recent refresh attempt didn't land.
  return { ...base, status: "healthy" };
}

function hoursAgo(iso: string, now: string): number {
  return Math.max(
    0,
    Math.round((new Date(now).getTime() - new Date(iso).getTime()) / (60 * 60_000)),
  );
}

/** User-facing sentence - never HTTP/internal error detail. */
export function describeSourceHealth(state: SourceHealthState): string {
  switch (state.status) {
    case "healthy":
      return "Live";
    case "rate_limited":
      return "Source rate-limited. Last confirmed results remain available when present.";
    case "stale": {
      if (!state.lastSuccessfulRefreshAt) return "Source refresh delayed.";
      const hours = hoursAgo(state.lastSuccessfulRefreshAt, state.lastAttemptAt);
      return `Last confirmed ${hours}h ago.`;
    }
    case "unavailable": {
      if (!state.lastSuccessfulRefreshAt) {
        return "Source unavailable. No confirmed observation yet.";
      }
      const hours = hoursAgo(state.lastSuccessfulRefreshAt, state.lastAttemptAt);
      return `Source unavailable. Last confirmed ${hours}h ago.`;
    }
  }
}
