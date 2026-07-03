import type { OpportunityState } from "@/lib/discover/discover-opportunity-state";

/** Structured Discover action API response — always JSON. */
export type DiscoverActionSuccess = {
  ok: true;
  action: string;
  entityId?: string;
  status: string;
  amountUsd?: number;
  txHash?: string;
  receiptUrl?: string;
  proofId?: string;
  nextState?: OpportunityState;
  message?: string;
};

export type DiscoverActionFailure = {
  ok: false;
  code: string;
  message: string;
  nextAction?: string;
};

export type DiscoverActionResponse = DiscoverActionSuccess | DiscoverActionFailure;

export function discoverActionError(
  code: string,
  message: string,
  nextAction?: string,
): DiscoverActionFailure {
  return { ok: false, code, message, nextAction };
}
