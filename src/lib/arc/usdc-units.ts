const NATIVE_TO_MICRO_DIVISOR = 1_000_000_000_000n;
const MATERIAL_MISMATCH_MICRO_USDC = 1n;

export function nativeWeiToMicroUsdc(value: bigint): bigint {
  return value / NATIVE_TO_MICRO_DIVISOR;
}

export function erc20UnitsToMicroUsdc(value: bigint): bigint {
  return value;
}

export function microUsdcToString(value: bigint): string {
  const safe = value < 0n ? 0n : value;
  const whole = safe / 1_000_000n;
  const fraction = (safe % 1_000_000n).toString().padStart(6, "0");
  const trimmed = fraction.replace(/0+$/, "").padEnd(2, "0");
  return `${whole}.${trimmed}`;
}

export function reconcileArcUsdcInterfaces(input: {
  nativeWei?: bigint;
  erc20Units?: bigint;
}): {
  amountMicroUsdc: bigint;
  source: "native_rpc" | "erc20_rpc";
  nativeMicroUsdc?: bigint;
  erc20MicroUsdc?: bigint;
  mismatch: boolean;
} {
  const nativeMicroUsdc =
    input.nativeWei === undefined ? undefined : nativeWeiToMicroUsdc(input.nativeWei);
  const erc20MicroUsdc =
    input.erc20Units === undefined ? undefined : erc20UnitsToMicroUsdc(input.erc20Units);

  if (nativeMicroUsdc === undefined && erc20MicroUsdc === undefined) {
    throw new Error("arc_balance_missing");
  }

  const difference =
    nativeMicroUsdc !== undefined && erc20MicroUsdc !== undefined
      ? nativeMicroUsdc >= erc20MicroUsdc
        ? nativeMicroUsdc - erc20MicroUsdc
        : erc20MicroUsdc - nativeMicroUsdc
      : 0n;

  return {
    amountMicroUsdc: nativeMicroUsdc ?? erc20MicroUsdc!,
    source: nativeMicroUsdc !== undefined ? "native_rpc" : "erc20_rpc",
    nativeMicroUsdc,
    erc20MicroUsdc,
    mismatch: difference > MATERIAL_MISMATCH_MICRO_USDC,
  };
}
