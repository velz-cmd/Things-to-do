"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DiscoverAction } from "@/lib/discover/types";
import {
  apiCreateProgram,
  apiDiscoverAction,
  apiFetchWallet,
  apiFundProgram,
  apiInstallCommunity,
  apiResolveFundTarget,
  apiVerifyAndShareReceipt,
  fundParamsFromAction,
  type FundSheetRequest,
  type WalletSnapshot,
} from "@/lib/discover/discover-action-engine";
import { DiscoverFundSheet } from "@/components/resolve/discover/discover-fund-sheet";
import { DiscoverActionConfirmSheet } from "@/components/resolve/discover/discover-action-confirm-sheet";
import {
  discoverActionNeedsConfirm,
} from "@/lib/discover/discover-action-copy";
import { pushJellyfinWatchesFromBrowser } from "@/lib/integrations/jellyfin-client-sync";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useDiscoverActionAudit } from "@/components/resolve/discover/discover-action-audit-panel";
import { useAuth } from "@/components/auth/auth-provider";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { tailorDiscoverActionsForUser } from "@/lib/discover/tailor-actions-for-user";
import { communitySlugFromDiscoverTarget } from "@/lib/discover/discover-inline-target";
import {
  communityConsolePath,
  discoverAutomatePath,
  type CommunityIntent,
} from "@/lib/communities/community-nav";

type DiscoverActionsContextValue = {
  signedIn: boolean;
  wallet: WalletSnapshot;
  busy: boolean;
  runAction: (action: DiscoverAction, surface?: string) => Promise<void>;
  openFundSheet: (req: FundSheetRequest) => void;
  refreshWallet: () => Promise<void>;
  executeFund: (req: FundSheetRequest & { amountUsd: number }) => Promise<void>;
};

const DiscoverActionsContext = createContext<DiscoverActionsContextValue | null>(null);

function missingFields(action: DiscoverAction): string[] {
  const missing: string[] = [];
  if (action.kind === "fund" || action.kind === "sponsor") {
    if (!action.programId && !action.communitySlug && !action.missionId) {
      missing.push("programId, communitySlug, or missionId");
    }
  }
  if (action.kind === "install" || action.kind === "create_program" || action.kind === "console") {
    if (!action.communitySlug) missing.push("communitySlug");
  }
  if (action.kind === "share" && !action.href) missing.push("receipt href");
  if (action.kind === "open" && !action.entityPath && !action.href) missing.push("entityPath or href");
  return missing;
}

function actionFailureDescription(action: DiscoverAction, code?: string, nextAction?: string): string | undefined {
  if (code === "DATABASE_BUSY") {
    return action.communitySlug
      ? "The database connection is busy. Retry, or open the community console and continue setup there."
      : "The database connection is busy. Retry in a moment from Discover.";
  }
  if (nextAction === "add_funds") return "Open Capital to add USDC, then return to Discover.";
  if (nextAction === "connect_source") return "Open Profile to connect the proof source, then return to Discover.";
  if (nextAction === "create_rule") return "No payout rule exists yet. Create one in Communities.";
  return undefined;
}

export function DiscoverActionsProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const { balance, balanceLoading, refreshBalance } = useAuth();
  const { state: connections, reload: reloadConnections } = useUserConnections();
  const { reportActionStatus } = useDiscoverActionAudit();
  const queryClient = useQueryClient();
  const [wallet, setWallet] = useState<WalletSnapshot>({
    spendableUsd: 0,
    totalUsdc: "0",
    loaded: false,
  });
  const [busy, setBusy] = useState(false);
  const [fundSheet, setFundSheet] = useState<FundSheetRequest | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    action: DiscoverAction;
    surface: string;
    amountUsd?: number;
  } | null>(null);

  const refreshWallet = useCallback(async () => {
    if (!signedIn) {
      setWallet({ spendableUsd: 0, totalUsdc: "0", loaded: true });
      return;
    }
    if (balance) {
      setWallet({
        spendableUsd: balance.availableUsd,
        totalUsdc: String(balance.onChainUsd ?? balance.availableUsd),
        loaded: true,
        address: balance.walletAddress,
      });
      return;
    }
    const snap = await apiFetchWallet();
    setWallet(snap);
  }, [signedIn, balance]);

  useEffect(() => {
    if (!signedIn) {
      setWallet({ spendableUsd: 0, totalUsdc: "0", loaded: true });
      return;
    }
    if (balance) {
      setWallet({
        spendableUsd: balance.availableUsd,
        totalUsdc: String(balance.onChainUsd ?? balance.availableUsd),
        loaded: true,
        address: balance.walletAddress,
      });
      return;
    }
    if (!balanceLoading) {
      void refreshWallet();
    }
  }, [signedIn, balance, balanceLoading, refreshWallet]);

  const navigateToCommunity = useCallback(
    (communitySlug: string, intent?: CommunityIntent, options?: { tab?: "advanced" }) => {
      router.push(communityConsolePath(communitySlug, intent, options));
    },
    [router],
  );

  const ensureProgram = useCallback(
    async (target: {
      programId: string | null;
      communitySlug: string;
      templateId: string;
      needsInstall: boolean;
    }) => {
      if (target.programId) return target.programId;

      if (target.needsInstall) {
        toast.loading(`Setting up ${target.communitySlug}…`, { id: "discover-chain" });
        try {
          await apiInstallCommunity(target.communitySlug);
        } catch (e) {
          toast.dismiss("discover-chain");
          throw e;
        }
        void reloadConnections();
      }

      toast.loading("Creating Program...", { id: "discover-chain" });
      const created = await apiCreateProgram(target.communitySlug, target.templateId);
      toast.dismiss("discover-chain");
      if (!created.program?.id) throw new Error("Program was not created - try again in a moment");
      return created.program.id;
    },
    [reloadConnections],
  );

  const executeFund = useCallback(
    async (req: FundSheetRequest & { amountUsd: number }, surface = "fund-sheet") => {
      if (!signedIn) {
        router.push("/login?next=/discover");
        return;
      }

      if (req.amountUsd < 5) {
        throw new Error("Amount can't be less than $5");
      }

      if (wallet.loaded && wallet.spendableUsd < req.amountUsd) {
        throw new Error(
          wallet.spendableUsd <= 0
            ? "No spendable USDC — add funds in Capital before funding programs"
            : `Insufficient wallet balance: $${wallet.spendableUsd.toFixed(2)} spendable, need $${req.amountUsd.toFixed(2)} — add USDC in Capital`,
        );
      }

      setBusy(true);
      const auditAction: DiscoverAction = {
        id: "fund-exec",
        label: req.label ?? "Fund",
        kind: "fund",
        programId: req.programId,
        communitySlug: req.communitySlug,
        templateId: req.templateId,
        missionId: req.missionId,
        amountUsd: req.amountUsd,
      };
      reportActionStatus(surface, auditAction, "pending");

      try {
        let programId = req.programId;

        if (!programId) {
          toast.loading("Preparing pool…", { id: "discover-chain" });
          const target = await apiResolveFundTarget({
            programId: req.programId,
            communitySlug: req.communitySlug,
            templateId: req.templateId,
            missionId: req.missionId,
          });
          programId = await ensureProgram(target);
        }

        toast.loading(`Sending $${req.amountUsd.toFixed(2)} USDC to pool…`, {
          id: "discover-chain",
        });
        await apiFundProgram(programId, req.amountUsd);
        const fundedMessage = `You funded this pool $${req.amountUsd.toFixed(2)}`;
        toast.success(fundedMessage, {
          id: "discover-chain",
          description: "Arc USDC is pending confirmation in Capital",
        });
        reportActionStatus(surface, auditAction, "success", fundedMessage);
        await refreshBalance().catch(() => null);
        await refreshWallet();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.capitalState }),
          queryClient.invalidateQueries({ queryKey: queryKeys.communities }),
          queryClient.invalidateQueries({ queryKey: queryKeys.discoverRadarFeed() }),
        ]).catch(() => null);
        setFundSheet(null);
        if (req.communitySlug) {
          navigateToCommunity(req.communitySlug, "fund");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Fund failed";
        reportActionStatus(surface, auditAction, "error", msg);
        toast.error(msg, { id: "discover-chain" });
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [
      signedIn,
      router,
      wallet,
      ensureProgram,
      refreshWallet,
      refreshBalance,
      reportActionStatus,
      queryClient,
      navigateToCommunity,
    ],
  );

  const openFundSheet = useCallback(
    (req: FundSheetRequest) => {
      if (!signedIn) {
        router.push("/login?next=/discover");
        return;
      }
      if (wallet.loaded && wallet.spendableUsd <= 0) {
        toast.error("No spendable USDC - add funds in Capital before funding", {
          action: {
            label: "Open Capital",
            onClick: () => router.push("/capital"),
          },
        });
        return;
      }
      setFundSheet(req);
    },
    [signedIn, router, wallet.loaded, wallet.spendableUsd],
  );

  const refreshDiscover = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverRadarFeed() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.communities }),
      queryClient.invalidateQueries({ queryKey: queryKeys.capitalState }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profileState }),
      reloadConnections(),
      refreshWallet(),
    ]);
  }, [queryClient, reloadConnections, refreshWallet]);

  const executeConfirmedAction = useCallback(async () => {
    if (!confirmAction) return;
    const { action, surface, amountUsd } = confirmAction;
    setBusy(true);
    reportActionStatus(surface, action, "pending");
    try {
      const result = await apiDiscoverAction(action, { amountUsd, surface });
      if (!result.ok) {
        reportActionStatus(surface, action, "error", result.message);
        toast.error(result.message, {
          description: actionFailureDescription(action, result.code, result.nextAction),
        });
        if (result.nextAction === "add_funds") router.push("/capital");
        if (result.nextAction === "connect_source") router.push("/profile");
        return;
      }
      reportActionStatus(surface, action, "success", result.message);
      toast.success(result.message ?? "Action completed");
      if (result.status === "browser_sync" && action.communitySlug === "jellyfin") {
        try {
          const browser = await pushJellyfinWatchesFromBrowser();
          if (browser.ingested > 0) {
            toast.success(`Imported ${browser.ingested} watch events`);
          }
        } catch {
          toast.message("Open Jellyfin in this browser to finish reading watch activity");
        }
      }
      if (result.receiptUrl) {
        router.push(result.receiptUrl);
      } else if (result.action === "connect_source") {
        router.push("/profile");
      } else if (result.action === "claim_value") {
        router.push(action.href ?? "/claim");
      } else if (action.communitySlug) {
        const intent: CommunityIntent | undefined =
          action.kind === "create_program" || result.action === "create_rule"
            ? "create_program"
            : action.kind === "install" || result.action === "create_community_program"
              ? "install"
              : undefined;
        navigateToCommunity(action.communitySlug, intent);
      }
      setConfirmAction(null);
      await refreshDiscover();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Action failed";
      reportActionStatus(surface, action, "error", msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }, [
    confirmAction,
    reportActionStatus,
    router,
    refreshDiscover,
    navigateToCommunity,
  ]);

  const runAction = useCallback(
    async (rawAction: DiscoverAction, surface = "discover") => {
      const [action = rawAction] = tailorDiscoverActionsForUser([rawAction], connections);
      const authRequired = [
        "fund",
        "install",
        "create_program",
        "automate",
        "claim",
        "connect_sensor",
        "sponsor",
        "share",
      ];

      const missing = missingFields(action);
      if (missing.length) {
        const blocker = `Missing: ${missing.join(", ")}`;
        reportActionStatus(surface, action, "blocked", blocker);
        toast.error(blocker, { description: `Action "${action.label}" cannot run without required data` });
        return;
      }

      if (!signedIn && authRequired.includes(action.kind)) {
        const blocker = `Sign in to ${action.label.toLowerCase()}`;
        reportActionStatus(surface, action, "blocked", blocker);
        toast.error(blocker, {
          description:
            "Install, fund, and claim actions write to your account — sign in to continue",
        });
        router.push("/login?next=/discover");
        return;
      }

      if (discoverActionNeedsConfirm(action)) {
        setConfirmAction({ action, surface, amountUsd: action.amountUsd });
        return;
      }

      reportActionStatus(surface, action, "pending");

      try {
        switch (action.kind) {
          case "open": {
            const proofHref = action.href ?? action.entityPath;
            if (proofHref?.includes("/receipt/") || proofHref?.includes("/ledger/")) {
              setBusy(true);
              try {
                const result = await apiDiscoverAction(action, { surface });
                if (!result.ok) {
                  toast.error(result.message);
                  reportActionStatus(surface, action, "blocked", result.message);
                  break;
                }
                router.push(result.receiptUrl ?? proofHref);
                reportActionStatus(surface, action, "success");
              } finally {
                setBusy(false);
              }
              break;
            }
            const inlineSlug =
              communitySlugFromDiscoverTarget(action.entityPath) ??
              communitySlugFromDiscoverTarget(action.href);
            if (inlineSlug && action.label.toLowerCase().includes("proof")) {
              navigateToCommunity(inlineSlug, undefined, { tab: "advanced" });
              reportActionStatus(surface, action, "success");
              break;
            }
            const target = action.entityPath ?? action.href;
            if (!target) break;
            router.push(target);
            reportActionStatus(surface, action, "success");
            break;
          }

          case "fund":
          case "sponsor":
            if (action.amountUsd && action.amountUsd >= 5 && action.programId) {
              await executeFund(
                {
                  programId: action.programId,
                  amountUsd: action.amountUsd,
                  label: action.label,
                },
                surface,
              );
            } else {
              openFundSheet(fundParamsFromAction(action));
              reportActionStatus(surface, action, "success", "Opened fund form");
            }
            break;

          case "console": {
            const slug = action.communitySlug;
            if (!slug) break;
            navigateToCommunity(slug);
            reportActionStatus(surface, action, "success");
            break;
          }

          case "install":
          case "create_program":
          case "analyze":
            setConfirmAction({ action, surface });
            reportActionStatus(surface, action, "idle");
            break;

          case "connect_sensor": {
            const target = action.href ?? "/profile";
            router.push(target);
            void apiDiscoverAction(action, { surface }).catch(() => null);
            reportActionStatus(surface, action, "success");
            break;
          }

          case "claim":
            router.push(action.href ?? "/claim");
            reportActionStatus(surface, action, "success");
            break;

          case "share":
            if (action.href) {
              setBusy(true);
              try {
                const url = await apiVerifyAndShareReceipt(action.href, window.location.origin);
                toast.success("Receipt link copied", { description: url });
                reportActionStatus(surface, action, "success");
              } catch (e) {
                const msg = e instanceof Error ? e.message : "Receipt not found";
                reportActionStatus(surface, action, "blocked", msg);
                toast.error(msg, {
                  description: "GET /api/receipt/{id} failed — authorization may still be pending",
                });
                throw e;
              } finally {
                setBusy(false);
              }
            }
            break;

          case "automate":
            if (action.communitySlug && action.templateId) {
              setBusy(true);
              try {
                toast.loading("Analyzing proof...", { id: "discover-chain" });
                const target = await apiResolveFundTarget({
                  communitySlug: action.communitySlug,
                  templateId: action.templateId,
                });
                const programId = await ensureProgram(target);
                toast.loading("Preparing Arc settlement state...", { id: "discover-chain" });
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: queryKeys.communities }),
                  queryClient.invalidateQueries({
                    queryKey: queryKeys.communitySurface(action.communitySlug, "lite"),
                  }),
                  queryClient.invalidateQueries({
                    queryKey: queryKeys.communitySurface(action.communitySlug, "full"),
                  }),
                  queryClient.invalidateQueries({ queryKey: queryKeys.discoverRadarFeed() }),
                ]);
                toast.success("Program Active", {
                  id: "discover-chain",
                  description: `Program ${programId} saved. Fund the pool to submit Arc settlement.`,
                });
                navigateToCommunity(action.communitySlug, "create_program");
                reportActionStatus(surface, action, "success", `Program ${programId}`);
              } finally {
                setBusy(false);
              }
            } else if (action.communitySlug) {
              router.push(
                discoverAutomatePath(action.communitySlug, {
                  trigger: action.automationTrigger,
                }),
              );
              reportActionStatus(surface, action, "success");
            } else if (action.href) {
              router.push(action.href);
              reportActionStatus(surface, action, "success");
            } else {
              reportActionStatus(surface, action, "blocked", "Community required for automation");
              toast.error("Install a community to automate");
            }
            break;

          default:
            if (action.href) {
              router.push(action.href);
              reportActionStatus(surface, action, "success");
            } else {
              reportActionStatus(surface, action, "blocked", "No handler for action kind");
            }
        }
      } catch (e) {
        if (action.kind !== "fund" && action.kind !== "sponsor") {
          const msg = e instanceof Error ? e.message : "Action failed";
          reportActionStatus(surface, action, "error", msg);
        }
      }
    },
    [
      signedIn,
      router,
      executeFund,
      openFundSheet,
      reportActionStatus,
      connections,
      navigateToCommunity,
      ensureProgram,
      queryClient,
    ],
  );

  const value = useMemo(
    () => ({
      signedIn,
      wallet,
      busy,
      runAction,
      openFundSheet,
      refreshWallet,
      executeFund,
    }),
    [signedIn, wallet, busy, runAction, openFundSheet, refreshWallet, executeFund],
  );

  return (
    <DiscoverActionsContext.Provider value={value}>
      {children}
      <DiscoverFundSheet
        open={Boolean(fundSheet)}
        request={fundSheet}
        wallet={wallet}
        busy={busy}
        onClose={() => setFundSheet(null)}
        onConfirm={(amountUsd) => {
          if (!fundSheet) return;
          void executeFund({ ...fundSheet, amountUsd });
        }}
      />
      <DiscoverActionConfirmSheet
        open={Boolean(confirmAction)}
        action={confirmAction?.action ?? null}
        connections={connections}
        wallet={wallet}
        busy={busy}
        amountUsd={confirmAction?.amountUsd}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => void executeConfirmedAction()}
      />
    </DiscoverActionsContext.Provider>
  );
}

export function useDiscoverActions() {
  const ctx = useContext(DiscoverActionsContext);
  if (!ctx) {
    throw new Error("useDiscoverActions must be used within DiscoverActionsProvider");
  }
  return ctx;
}
