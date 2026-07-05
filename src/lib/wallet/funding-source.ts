export type FundingSource = "app" | "external";

export type FundingBalances = {
  appSpendableUsd: number;
  externalSpendableUsd: number;
};

/** Pick whichever wallet can pay — external first when connected (user choice over auto Gmail path). */
export function pickFundingSource(
  amountUsd: number,
  balances: FundingBalances,
  externalReady: boolean,
): FundingSource | null {
  if (amountUsd <= 0) return null;
  const extOk = externalReady && balances.externalSpendableUsd >= amountUsd;
  const appOk = balances.appSpendableUsd >= amountUsd;
  if (extOk) return "external";
  if (appOk) return "app";
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
