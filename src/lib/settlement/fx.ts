/** Supported payout currencies on Arc — founder funds once; contributors choose preference. */
export type PayoutCurrency = "USDC" | "EURC" | "CIRBTC";

export const PAYOUT_CURRENCIES: {
  id: PayoutCurrency;
  label: string;
  description: string;
}[] = [
  {
    id: "USDC",
    label: "USDC",
    description: "Default — settle directly on Arc testnet",
  },
  {
    id: "EURC",
    label: "EURC",
    description: "Swap after claim via AppKit on Arc (stablecoin FX)",
  },
  {
    id: "CIRBTC",
    label: "cirBTC",
    description: "Swap after claim via AppKit on Arc",
  },
];

export function normalizePayoutCurrency(raw?: string | null): PayoutCurrency {
  const v = raw?.toUpperCase();
  if (v === "EURC" || v === "CIRBTC") return v;
  return "USDC";
}

/** Arc testnet token references — aligned with circlefin/arc-stablecoin-fx sample. */
export const ARC_FX_TOKENS: Record<
  PayoutCurrency,
  { symbol: string; contractAddress: string | null }
> = {
  USDC: {
    symbol: "USDC",
    contractAddress:
      process.env.ARC_USDC_CONTRACT ?? "0x3600000000000000000000000000000000000000",
  },
  EURC: {
    symbol: "EURC",
    contractAddress: process.env.ARC_EURC_CONTRACT ?? null,
  },
  CIRBTC: {
    symbol: "cirBTC",
    contractAddress: process.env.ARC_CIRBTC_CONTRACT ?? null,
  },
};

export function fxSwapAvailable(currency: PayoutCurrency): boolean {
  if (currency === "USDC") return true;
  return Boolean(ARC_FX_TOKENS[currency].contractAddress);
}

export function fxSwapSampleUrl(): string {
  return (
    process.env.NEXT_PUBLIC_ARC_FX_SAMPLE_URL?.trim() ??
    "https://github.com/circlefin/arc-stablecoin-fx"
  );
}

export type FxSwapHint = {
  fromCurrency: "USDC";
  toCurrency: PayoutCurrency;
  amountUsd: number;
  swapAvailable: boolean;
  sampleUrl: string;
  message: string;
};

/** Post-claim FX hint — settlement is USDC; contributor swaps client-side if preferred. */
export function buildFxSwapHint(
  amountUsd: number,
  preferred: PayoutCurrency,
): FxSwapHint | null {
  if (preferred === "USDC") return null;

  const swapAvailable = fxSwapAvailable(preferred);
  return {
    fromCurrency: "USDC",
    toCurrency: preferred,
    amountUsd,
    swapAvailable,
    sampleUrl: fxSwapSampleUrl(),
    message: swapAvailable
      ? `You received USDC. Swap to ${preferred} in your wallet when ready.`
      : `${preferred} contracts not configured on this deployment — USDC sent instead.`,
  };
}
