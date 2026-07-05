export type FundingSource = "app" | "external";

export type FundingBalances = {
  appSpendableUsd: number;
  externalSpendableUsd: number;
};

/** Prefer RESOLVE app wallet (ledger) — no extra signature when it can cover the amount. */
export function pickFundingSource(
  amountUsd: number,
  balances: FundingBalances,
  externalReady: boolean,
): FundingSource | null {
  if (amountUsd <= 0) return null;
  if (balances.appSpendableUsd >= amountUsd) return "app";
  if (externalReady && balances.externalSpendableUsd >= amountUsd) return "external";
  return null;
}

export function maxSpendableUsd(
  balances: FundingBalances,
  externalReady: boolean,
): number {
  const ext = externalReady ? balances.externalSpendableUsd : 0;
  return Math.max(balances.appSpendableUsd, ext);
}

export function fundingSourceLabel(source: FundingSource): string {
  return source === "app" ? "RESOLVE wallet" : "your connected wallet";
}
