import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { CapitalBootstrap } from "@/lib/capital/bootstrap";
import { embeddedWalletFor } from "@/lib/wallet/embedded";

/** Auth-backed Capital shell used only when persisted financial state is unavailable. */
export function offlineCapitalBootstrap(authUser: SupabaseUser): CapitalBootstrap {
  const generatedAt = new Date().toISOString();
  const address = embeddedWalletFor(authUser.id).toLowerCase() as `0x${string}`;
  const appWallet = {
    walletId: `embedded:${authUser.id}`,
    address,
    provider: "resolve" as const,
  };
  const appBalance = {
    walletType: "app" as const,
    address,
    amountMicroUsdc: "0",
    availableMicroUsdc: "0",
    freshness: "unknown" as const,
    readAt: null,
  };

  return {
    ok: true,
    dataQuality: {
      status: "degraded",
      source: "server_fallback",
      message: "Persisted Capital records are temporarily unavailable. No balance was inferred.",
    },
    wallets: {
      appWallet,
      connectedWallet: null,
      payoutWallet: null,
      selectedCapitalWallet: "app",
      updatedAt: generatedAt,
    },
    balances: {
      app: appBalance,
      connected: null,
      selected: appBalance,
      portfolioTotalMicroUsdc: "0",
    },
    moneyState: {
      availableMicroUsdc: "0",
      reservedMicroUsdc: "0",
      committedMicroUsdc: "0",
      pendingMicroUsdc: "0",
      claimableMicroUsdc: "0",
      settledThirtyDayMicroUsdc: "0",
    },
    authorizations: [],
    settlementQueue: [],
    fundingIntents: [],
    claims: [],
    recentActivity: [],
    guardrails: null,
    sync: {
      balanceState: "unknown",
      networkHealth: "unavailable",
      lastSuccessfulSyncAt: null,
      liveSyncRecommended: true,
    },
    generatedAt,
  };
}
