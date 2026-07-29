import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { CapitalBootstrap } from "@/lib/capital/bootstrap";
import { embeddedWalletFor } from "@/lib/wallet/embedded";
import type { WorkspaceReadiness } from "@/lib/workspace/readiness-contract";

/** Auth-backed Capital shell used only when persisted financial state is unavailable. */
export function offlineCapitalBootstrap(
  authUser: SupabaseUser,
  readiness?: WorkspaceReadiness | null,
): CapitalBootstrap {
  const generatedAt = new Date().toISOString();
  const fallbackAddress = embeddedWalletFor(authUser.id).toLowerCase() as `0x${string}`;
  const appAddress = (readiness?.wallets.app.address ?? fallbackAddress) as `0x${string}`;
  const appWallet = readiness?.wallets.app.address
    ? {
        walletId: `persisted:${authUser.id}`,
        address: appAddress,
        provider: "resolve" as const,
      }
    : {
        walletId: `embedded:${authUser.id}`,
        address: fallbackAddress,
        provider: "resolve" as const,
      };
  const connectedWallet = readiness?.wallets.connected.address
    ? {
        address: readiness.wallets.connected.address as `0x${string}`,
        connector: "reown" as const,
      }
    : null;
  const payoutWallet = readiness?.wallets.payout.address
    ? {
        address: readiness.wallets.payout.address as `0x${string}`,
        verificationState:
          readiness.wallets.payout.state === "connected"
            ? ("verified" as const)
            : ("pending" as const),
      }
    : null;
  const selectedKind = readiness?.wallets.selectedKind ?? "app";
  const lastBalance = readiness?.wallets.lastConfirmedBalanceMicroUsdc ?? null;
  const lastBalanceAt = readiness?.wallets.lastConfirmedBalanceAt ?? null;
  const appBalance =
    lastBalance && selectedKind === "app"
      ? {
          walletType: "app" as const,
          address: appAddress,
          amountMicroUsdc: lastBalance,
          availableMicroUsdc: lastBalance,
          freshness: "stale" as const,
          readAt: lastBalanceAt,
        }
      : null;
  const connectedBalance =
    lastBalance && selectedKind === "connected" && connectedWallet
      ? {
          walletType: "connected" as const,
          address: connectedWallet.address,
          amountMicroUsdc: lastBalance,
          availableMicroUsdc: lastBalance,
          freshness: "stale" as const,
          readAt: lastBalanceAt,
        }
      : null;
  const selectedBalance = selectedKind === "connected" ? connectedBalance : appBalance;
  return {
    ok: true,
    dataQuality: {
      status: "degraded",
      source: "server_fallback",
      message: "Persisted Capital records are temporarily unavailable. No balance was inferred.",
    },
    wallets: {
      appWallet,
      connectedWallet,
      payoutWallet,
      selectedCapitalWallet: selectedKind,
      updatedAt: readiness?.computedAt ?? generatedAt,
    },
    balances: {
      app: appBalance,
      connected: connectedBalance,
      selected: selectedBalance,
      portfolioTotalMicroUsdc: lastBalance,
    },
    moneyState: {
      availableMicroUsdc: lastBalance ?? "0",
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
      balanceState: lastBalance ? "stale" : "unknown",
      networkHealth: lastBalance ? "degraded" : "unavailable",
      lastSuccessfulSyncAt: lastBalanceAt,
      liveSyncRecommended: true,
    },
    generatedAt,
  };
}
