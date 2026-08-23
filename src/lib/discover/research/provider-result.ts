/**
 * Structured provider fetch result (Phase 3 item A2).
 *
 * `fulfilled []` is ambiguous between "the provider succeeded and had
 * nothing to report" and "the provider failed". That distinction is not
 * optional - health state must never be inferred from result-array
 * length. Every Discover-facing connector wrapper returns this shape
 * instead, so source-health classification always has real HTTP/timeout
 * information to work from, not a guess.
 */
export type ProviderFetchStatus = "ok" | "rate_limited" | "unavailable";

export type ProviderFetchResult<T> = {
  status: ProviderFetchStatus;
  records: T[];
  attemptedAt: string;
  completedAt: string;
  /** Sanitized, non-alarming reason - never raw HTTP/exception text. Present only when status !== "ok". */
  sanitizedReason?: string;
};

/** Maps a fetch Response (or a caught exception) to a provider status - never infers from result length. */
export function classifyFetchOutcome(input: {
  response?: Response;
  threwTimeoutOrNetworkError?: boolean;
}): { status: ProviderFetchStatus; sanitizedReason?: string } {
  if (input.threwTimeoutOrNetworkError) {
    return { status: "unavailable", sanitizedReason: "The source did not respond in time." };
  }
  const res = input.response;
  if (!res) {
    return { status: "unavailable", sanitizedReason: "The source is unavailable." };
  }
  if (res.status === 429) {
    return { status: "rate_limited", sanitizedReason: "The source is rate-limiting requests." };
  }
  if (!res.ok) {
    return {
      status: "unavailable",
      sanitizedReason:
        res.status >= 500
          ? "The source is temporarily unavailable."
          : "The source rejected the request.",
    };
  }
  return { status: "ok" };
}
