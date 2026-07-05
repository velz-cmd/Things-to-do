/** Honest user-facing copy for in-flight actions — no fake "syncing" on timeouts or DB errors. */

export function requestTimedOut(action: string): string {
  return `${action} timed out. Try again.`;
}

export const ACTION_ERRORS = {
  programCreateTimeout: requestTimedOut("Program creation"),
  fundTimeout: requestTimedOut("Funding"),
  discoverActionTimeout:
    "This action timed out. Open the community console or Capital, then try again.",
  arcSettlementTimeout: requestTimedOut("Arc settlement"),
  attachCommunityTimeout: requestTimedOut("Attach community"),

  databaseUnavailable:
    "Database temporarily unavailable. Try again in a moment.",
  fundingFailedRetry:
    "Funding could not complete. Check Capital activity, then retry if needed.",

  arcBalanceLoading: "Loading Arc balance from testnet…",
  arcBalanceCached: "Using last known Arc balance.",
  arcBalanceUnavailable:
    "Could not load live Arc balance. Refresh Capital before funding.",

  metricsLoading: "Loading community metrics…",
  metricsCachedBanner:
    "Showing cached totals while live program and obligation data loads.",
  obligationsLoading:
    "Payee details are still loading — refresh metrics in a moment.",

  discoveryEmpty:
    "No ranked opportunities yet — refresh or attach a community below.",
  networkPulseEmpty:
    "Network pulse is empty — public programs and ledger rows appear as they rank.",
} as const;

/** Map infra error text to honest user copy (never pretend a timeout is "syncing"). */
export function honestInfraError(message: string, fallback: string = ACTION_ERRORS.databaseUnavailable): string {
  if (/timed out|timeout|AbortError/i.test(message)) {
    return requestTimedOut("Request");
  }
  if (/connection pool|prisma|database|ECONNRESET|fetch failed/i.test(message)) {
    return ACTION_ERRORS.databaseUnavailable;
  }
  if (/Arc RPC|rpc did not return/i.test(message)) {
    return ACTION_ERRORS.arcBalanceUnavailable;
  }
  return fallback;
}
