import type { CapitalWalletSelection } from "@/lib/wallet/canonical-wallet-registry";

export function preserveConfirmedBalance(
  previousMicroUsdc: bigint | null,
  liveMicroUsdc: bigint | null,
  liveReadSucceeded: boolean,
): bigint | null {
  if (!liveReadSucceeded) return previousMicroUsdc;
  return liveMicroUsdc;
}

export function calculateCapitalWalletAmounts(input: {
  appMicroUsdc: bigint;
  connectedMicroUsdc: bigint;
  reservedMicroUsdc: bigint;
  selectedWallet: CapitalWalletSelection;
}): {
  selectedBalanceMicroUsdc: bigint;
  availableMicroUsdc: bigint;
  portfolioTotalMicroUsdc: bigint;
} {
  const selectedBalanceMicroUsdc =
    input.selectedWallet === "connected" ? input.connectedMicroUsdc : input.appMicroUsdc;
  const selectedReserve = input.selectedWallet === "app" ? input.reservedMicroUsdc : 0n;
  return {
    selectedBalanceMicroUsdc,
    availableMicroUsdc:
      selectedBalanceMicroUsdc > selectedReserve
        ? selectedBalanceMicroUsdc - selectedReserve
        : 0n,
    portfolioTotalMicroUsdc: input.appMicroUsdc + input.connectedMicroUsdc,
  };
}
