import {
  ARC_CLIENT_WALLET_ADDRESS,
  getLiveBlockers,
  hasCircleCredentials,
  isLiveArcEnabled,
} from "@/lib/settlement/arc-config";
import { getArcUsdcBalance, isAlchemyConfigured } from "@/lib/wallet/alchemy";

export type ArcReadiness = {
  liveArc: boolean;
  blockers: string[];
  clientWallet: string | null;
  balanceUsd: number | null;
  canDistributeOnChain: boolean;
  message: string;
};

export async function getArcReadiness(requiredUsd = 0): Promise<ArcReadiness> {
  const blockers = [...getLiveBlockers()];
  const clientWallet = ARC_CLIENT_WALLET_ADDRESS ?? null;
  let balanceUsd: number | null = null;

  if (clientWallet && isAlchemyConfigured()) {
    try {
      const bal = await getArcUsdcBalance(clientWallet);
      balanceUsd = bal.balanceUsd;
      if (requiredUsd > 0 && balanceUsd < requiredUsd) {
        blockers.push(
          `Treasury wallet underfunded: ${balanceUsd.toFixed(2)} USDC available, ${requiredUsd.toFixed(2)} required`
        );
      } else if (balanceUsd < 0.01) {
        blockers.push("Treasury wallet has no USDC — fund ARC_CLIENT_WALLET_ADDRESS on Arc testnet");
      }
    } catch (e) {
      blockers.push(
        `Could not read treasury balance: ${e instanceof Error ? e.message : "unknown error"}`
      );
    }
  } else if (clientWallet && !isAlchemyConfigured()) {
    blockers.push("ALCHEMY_API_KEY required to verify treasury balance before on-chain payouts");
  }

  const liveArc = isLiveArcEnabled();
  const canDistributeOnChain =
    liveArc && blockers.length === 0 && (balanceUsd ?? 0) >= Math.max(requiredUsd, 0.01);

  let message = "On-chain Arc memo payouts ready";
  if (!hasCircleCredentials()) {
    message = "Circle credentials missing — distributions settle off-chain in DB";
  } else if (!clientWallet) {
    message = "ARC_CLIENT_WALLET_ADDRESS not set — distributions settle off-chain";
  } else if (balanceUsd !== null && balanceUsd < Math.max(requiredUsd, 0.01)) {
    message = `Treasury has ${balanceUsd.toFixed(2)} USDC — fund wallet for live memo payouts`;
  } else if (blockers.length > 0) {
    message = blockers[0]!;
  }

  return {
    liveArc,
    blockers,
    clientWallet,
    balanceUsd,
    canDistributeOnChain,
    message,
  };
}
