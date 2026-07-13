import { formatUnits, parseUnits } from "viem";

/** Arc's optional ERC-20 USDC interface uses six decimals. */
export const USDC_TOKEN_DECIMALS = 6;

/** Arc native gas accounting uses eighteen decimals. */
export const ARC_NATIVE_GAS_DECIMALS = 18;

function normalizeDecimal(value: string): string {
  const normalized = value.trim().replaceAll(",", "");
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(normalized)) {
    throw new Error("Amount must be a non-negative decimal string.");
  }
  return normalized;
}

export function parseUsdcTokenUnits(value: string): bigint {
  return parseUnits(normalizeDecimal(value), USDC_TOKEN_DECIMALS);
}

export function formatUsdcTokenUnits(value: bigint): string {
  return formatUnits(value, USDC_TOKEN_DECIMALS);
}

export function parseArcNativeGasUnits(value: string): bigint {
  return parseUnits(normalizeDecimal(value), ARC_NATIVE_GAS_DECIMALS);
}

export function formatArcNativeGasUnits(value: bigint): string {
  return formatUnits(value, ARC_NATIVE_GAS_DECIMALS);
}

/** Convert a UI number only at the boundary; domain storage should use integer units. */
export function uiUsdNumberToTokenUnits(value: number): bigint {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("USDC amount must be a finite non-negative number.");
  }
  return parseUsdcTokenUnits(value.toFixed(USDC_TOKEN_DECIMALS));
}

export function addUsdcTokenUnits(values: readonly bigint[]): bigint {
  return values.reduce((total, value) => total + value, BigInt(0));
}
