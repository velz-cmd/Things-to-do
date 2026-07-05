export type FundingSource = "app" | "external";

export type FundingBalances = {
  appSpendableUsd: number;
  externalSpendableUsd: number;
};

/** Wallets that can cover this amount (user may choose any). */
export function affordableFundingSources(
  amountUsd: number,
  balances: FundingBalances,
  externalReady: boolean,
): FundingSource[] {
  if (amountUsd <= 0) return [];
  const out: FundingSource[] = [];
  if (externalReady && balances.externalSpendableUsd >= amountUsd) out.push("external");
  if (balances.appSpendableUsd >= amountUsd) out.push("app");
  return out;
}

/** Wallets the user may select in the picker (independent of affordance). */
export function selectableFundingSources(
  hasLinkedExternal: boolean,
): FundingSource[] {
  const out: FundingSource[] = ["app"];
  if (hasLinkedExternal) out.push("external");
  return out;
}

/** Default when user has not picked — first affordable source (external before app when both work). */
export function pickFundingSource(
  amountUsd: number,
  balances: FundingBalances,
  externalReady: boolean,
  preferred?: FundingSource | null,
): FundingSource | null {
  const options = affordableFundingSources(amountUsd, balances, externalReady);
  if (!options.length) return null;
  if (preferred && options.includes(preferred)) return preferred;
  return options[0] ?? null;
}

export function maxSpendableUsd(
  balances: FundingBalances,
  externalReady: boolean,
  externalLinked = false,
): number {
  const ext =
    externalReady || externalLinked ? balances.externalSpendableUsd : 0;
  return Math.max(balances.appSpendableUsd, ext);
}

export function fundingSourceLabel(source: FundingSource): string {
  return source === "app" ? "RESOLVE wallet" : "connected wallet → treasury";
}
