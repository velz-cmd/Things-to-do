export type FundingPreflightFailure =
  | "recipient_unverified"
  | "pool_not_ready"
  | "payout_not_ready"
  | "network_unsupported"
  | "asset_unsupported"
  | "amount_invalid"
  | "balance_insufficient"
  | "spending_limit_exceeded"
  | "fee_invalid"
  | "idempotency_key_missing"
  | "not_authorized";

export type FundingPreflight =
  | {
      ok: true;
      amountMicroUsdc: bigint;
      feeMicroUsdc: bigint;
      totalMicroUsdc: bigint;
    }
  | { ok: false; blocker: FundingPreflightFailure };

export function directSupportPreflight(input: {
  recipientVerified: boolean;
  payoutReady: boolean;
  network: string;
  asset: string;
  amountMicroUsdc: bigint;
  balanceMicroUsdc: bigint;
  spendingLimitMicroUsdc: bigint | null;
  feeMicroUsdc: bigint;
  idempotencyKey: string;
  authorized: boolean;
}): FundingPreflight {
  if (!input.recipientVerified) return { ok: false, blocker: "recipient_unverified" };
  if (!input.payoutReady) return { ok: false, blocker: "payout_not_ready" };
  if (input.network !== "arc-testnet") return { ok: false, blocker: "network_unsupported" };
  if (input.asset !== "USDC") return { ok: false, blocker: "asset_unsupported" };
  if (input.amountMicroUsdc <= 0n) return { ok: false, blocker: "amount_invalid" };
  if (input.feeMicroUsdc < 0n) return { ok: false, blocker: "fee_invalid" };
  const total = input.amountMicroUsdc + input.feeMicroUsdc;
  if (input.balanceMicroUsdc < total) return { ok: false, blocker: "balance_insufficient" };
  if (
    input.spendingLimitMicroUsdc != null &&
    total > input.spendingLimitMicroUsdc
  ) {
    return { ok: false, blocker: "spending_limit_exceeded" };
  }
  if (!input.idempotencyKey.trim()) {
    return { ok: false, blocker: "idempotency_key_missing" };
  }
  if (!input.authorized) return { ok: false, blocker: "not_authorized" };
  return {
    ok: true,
    amountMicroUsdc: input.amountMicroUsdc,
    feeMicroUsdc: input.feeMicroUsdc,
    totalMicroUsdc: total,
  };
}

export function poolFundingPreflight(input: {
  poolPublished: boolean;
  policyActive: boolean;
  allocationLocked: boolean;
  amountMicroUsdc: bigint;
  balanceMicroUsdc: bigint;
  idempotencyKey: string;
  authorized: boolean;
}): FundingPreflight {
  if (!input.poolPublished || !input.policyActive || !input.allocationLocked) {
    return { ok: false, blocker: "pool_not_ready" };
  }
  if (input.amountMicroUsdc <= 0n) return { ok: false, blocker: "amount_invalid" };
  if (input.balanceMicroUsdc < input.amountMicroUsdc) {
    return { ok: false, blocker: "balance_insufficient" };
  }
  if (!input.idempotencyKey.trim()) {
    return { ok: false, blocker: "idempotency_key_missing" };
  }
  if (!input.authorized) return { ok: false, blocker: "not_authorized" };
  return {
    ok: true,
    amountMicroUsdc: input.amountMicroUsdc,
    feeMicroUsdc: 0n,
    totalMicroUsdc: input.amountMicroUsdc,
  };
}
