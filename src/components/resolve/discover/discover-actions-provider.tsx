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
  apiDeployProgramOnArc,
  apiDiscoverAction,
  apiInstallCommunity,
  apiResolveFundTarget,
  apiVerifyAndShareReceipt,
  fundParamsFromAction,
  isAcceptedBackgroundError,
  type FundSheetRequest,
  type WalletSnapshot,
} from "@/lib/discover/discover-action-engine";
import { ACTION_STATUS } from "@/lib/copy/action-status";
import { DiscoverFundSheet } from "@/components/resolve/discover/discover-fund-sheet";
import { DiscoverActionConfirmSheet } from "@/components/resolve/discover/discover-action-confirm-sheet";
import { useCommunityConsoleOptional } from "@/components/resolve/discover/discover-community-console-provider";
import {
  buildFundOutcomeSummary,
  buildFundOutcomeTitle,
  fundOutcomeSteps,
} from "@/lib/discover/discover-action-outcomes";
import { automateOutcomeSteps } from "@/lib/discover/discover-action-outcomes";
import { defaultTriggerForTemplate } from "@/lib/discover/automate-action-labels";
import {
  discoverActionNeedsConfirm,
} from "@/lib/discover/discover-action-copy";
import { pushJellyfinWatchesFromBrowser } from "@/lib/integrations/jellyfin-client-sync";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { useDiscoverActionAudit } from "@/components/resolve/discover/discover-action-audit-panel";
import { useSpendableUsd } from "@/hooks/use-spendable-usd";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { tailorDiscoverActionsForUser } from "@/lib/discover/tailor-actions-for-user";
import { communitySlugFromDiscoverTarget } from "@/lib/discover/discover-inline-target";
import {
  communityConsolePath,
  type CommunityIntent,
} from "@/lib/communities/community-nav";
import { fundingSourceLabel } from "@/lib/wallet/funding-source";
import type { FundingSource } from "@/lib/wallet/funding-source";
import { useFundProgramExecution } from "@/hooks/use-fund-program-execution";
import { dispatchCapitalRefresh, dispatchPoolRefresh } from "@/lib/capital/refresh-events";
import { dispatchProfileRefresh } from "@/lib/profile/refresh-events";

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
  const spendable = useSpendableUsd();
  const {
    externalWalletReady,
    openConnectWallet,
    pickFundingSource,
  } = useResolveAccess();
  const { fundProgress, resetFundProgress, executeFund: runFundExecution } =
    useFundProgramExecution();
  const { state: connections, reload: reloadConnections } = useUserConnections();
  const { reportActionStatus } = useDiscoverActionAudit();
  const communityConsole = useCommunityConsoleOptional();
  const openCommunityConsole = useCallback(
    (options: Parameters<NonNullable<typeof communityConsole>["open"]>[0]) => {
      communityConsole?.open(options);
    },
    [communityConsole],
  );
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
  const [fundOutcome, setFundOutcome] = useState<{
    amountUsd: number;
    programId?: string;
    communitySlug?: string;
    activityId?: string;
    txHash?: string;
    label?: string;
    programName?: string;
    whyFund?: string;
    whoBenefits?: string;
  } | null>(null);
  const [deployingArc, setDeployingArc] = useState(false);

  const refreshWallet = useCallback(async () => {
    if (!signedIn) {
      setWallet({ spendableUsd: 0, totalUsdc: "0", loaded: true });
      return;
    }
    setWallet({
      spendableUsd: spendable.spendableUsd,
      totalUsdc: String(spendable.totalUsdc),
      loaded: spendable.loaded,
      address: spendable.walletAddress,
    });
    await spendable.refresh().catch(() => null);
  }, [signedIn, spendable]);

  useEffect(() => {
    if (!signedIn) {
      setWallet({ spendableUsd: 0, totalUsdc: "0", loaded: true });
      return;
    }
    setWallet({
      spendableUsd: spendable.spendableUsd,
      totalUsdc: String(spendable.totalUsdc),
      loaded: spendable.loaded,
      address: spendable.walletAddress,
    });
  }, [signedIn, spendable.spendableUsd, spendable.totalUsdc, spendable.loaded, spendable.walletAddress]);

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
        if (!communityReadyForDiscover(target.communitySlug, connections)) {
          toast.loading(ACTION_STATUS.workingInstall, { id: "discover-chain" });
        }
        try {
          await apiInstallCommunity(target.communitySlug);
        } catch (e) {
          toast.dismiss("discover-chain");
          if (isAcceptedBackgroundError(e)) {
            void reloadConnections();
          } else {
            throw e;
          }
        }
        void reloadConnections();
      }

      toast.loading(ACTION_STATUS.workingProgram, { id: "discover-chain" });
      const created = await apiCreateProgram(target.communitySlug, target.templateId);
      toast.dismiss("discover-chain");
      if (!created.program?.id) {
        throw new Error("Program was not created — open Communities to verify");
      }
      return created.program.id;
    },
    [reloadConnections],
  );

  const effectiveSpendable = spendable.spendableUsd;

  const refreshDiscover = useCallback(async () => {
    dispatchCapitalRefresh({ reason: "action" });
    dispatchProfileRefresh();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.discoverRadarFeed() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.communities }),
      queryClient.invalidateQueries({ queryKey: queryKeys.capitalState }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profileState }),
      queryClient.invalidateQueries({ queryKey: queryKeys.myPoolStakes }),
      reloadConnections(),
      refreshWallet(),
    ]);
  }, [queryClient, reloadConnections, refreshWallet]);

  const executeFund = useCallback(
    async (
      req: FundSheetRequest & { amountUsd: number },
      surface = "fund-sheet",
      chosenSource?: FundingSource,
    ) => {
      if (!signedIn) {
        router.push("/login?next=/discover");
        return;
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
        const result = await runFundExecution(req, chosenSource);
        const fundedMessage = `${result.message} via ${fundingSourceLabel(result.fundingSource)}`;
        toast.success(fundedMessage, {
          id: "discover-chain",
          description: "See where your USDC went in this window",
        });
        reportActionStatus(surface, auditAction, "success", fundedMessage);
        setFundOutcome({
          amountUsd: req.amountUsd,
          programId: result.programId,
          communitySlug: req.communitySlug,
          activityId: result.activityId,
          txHash: result.txHash,
          label: req.label,
          programName: req.programName ?? req.label,
          whyFund: req.whyFund,
          whoBenefits: req.whoBenefits,
        });
        setFundSheet((prev) =>
          prev ??
          ({
            programId: result.programId ?? req.programId,
            communitySlug: req.communitySlug,
            templateId: req.templateId,
            missionId: req.missionId,
            label: req.label ?? req.programName ?? "Fund program",
            programName: req.programName ?? req.label,
            whyFund: req.whyFund,
            whoBenefits: req.whoBenefits,
            amountUsd: req.amountUsd,
          } satisfies FundSheetRequest),
        );
        dispatchPoolRefresh({
          programId: result.programId ?? req.programId,
          communitySlug: req.communitySlug,
        });
        await refreshWallet();
        await refreshDiscover();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Fund failed";
        if (isAcceptedBackgroundError(e)) {
          toast.message(ACTION_STATUS.acceptedBackground, { id: "discover-chain" });
          await refreshDiscover();
          return;
        }
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
      runFundExecution,
      refreshWallet,
      reportActionStatus,
      refreshDiscover,
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
      if (result.status === "accepted") {
        toast.message(result.message ?? ACTION_STATUS.acceptedBackground);
        await refreshDiscover();
        setConfirmAction(null);
        return;
      }
      reportActionStatus(surface, action, "success", result.message);
      toast.success(result.message ?? "Action completed");

      if (action.kind === "create_program" && result.entityId && action.communitySlug) {
        setConfirmAction(null);
        openFundSheet({
          programId: result.entityId,
          communitySlug: action.communitySlug,
          templateId: action.templateId,
          label: `Fund ${action.label}`,
        });
        toast.message("Next: fund the pool on Arc", {
          description: "Min $5 USDC — pool balance appears in Capital and Communities",
        });
        await refreshDiscover();
        return;
      }

      if (action.kind === "automate" && action.communitySlug) {
        setConfirmAction(null);
        openCommunityConsole({
          communitySlug: action.communitySlug,
          label: action.label,
          tab: "automate",
          automationTrigger:
            action.automationTrigger ?? defaultTriggerForTemplate(action.templateId),
          actionContext: "automate",
        });
        toast.message("Auto-pay rule live", {
          description: automateOutcomeSteps({ communitySlug: action.communitySlug })[1]?.description,
        });
        await refreshDiscover();
        return;
      }

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
    openFundSheet,
    openCommunityConsole,
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
            if (
              action.communitySlug &&
              communityReadyForDiscover(action.communitySlug, connections)
            ) {
              navigateToCommunity(action.communitySlug);
              reportActionStatus(surface, action, "success", "Profile already linked");
              break;
            }
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
            if (action.href) {
              router.push(action.href);
              reportActionStatus(surface, action, "success");
            } else if (action.communitySlug) {
              openCommunityConsole({
                communitySlug: action.communitySlug,
                label: action.label,
                tab: "automate",
                automationTrigger:
                  action.automationTrigger ?? defaultTriggerForTemplate(action.templateId),
                actionContext: "automate",
              });
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
      openCommunityConsole,
    ],
  );

  const handleDeployFromFundOutcome = useCallback(async () => {
    if (!fundOutcome?.communitySlug || !fundOutcome.programId) return;
    setDeployingArc(true);
    try {
      const result = await apiDeployProgramOnArc(
        fundOutcome.communitySlug,
        fundOutcome.programId,
      );
      toast.success(result.message ?? "Settlement submitted on Arc", {
        description:
          result.explorerUrls?.[0] ? "View receipt in Capital activity" : undefined,
      });
      await refreshDiscover();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Arc settlement failed", {
        description: "Authorizations may still be pending — run analysis or wait for ingest",
      });
    } finally {
      setDeployingArc(false);
    }
  }, [fundOutcome, refreshDiscover]);

  const value = useMemo(
    () => ({
      signedIn,
      wallet: {
        ...wallet,
        spendableUsd: effectiveSpendable,
        loaded: spendable.loaded,
      },
      busy,
      runAction,
      openFundSheet,
      refreshWallet,
      executeFund,
      openConnectWallet,
      externalWalletReady,
      pickFundingSource,
      appWalletUsd: spendable.appSpendableUsd,
      externalWalletUsd: spendable.externalSpendableUsd,
    }),
    [signedIn, wallet, busy, runAction, openFundSheet, refreshWallet, executeFund, effectiveSpendable, externalWalletReady, openConnectWallet, spendable.loaded, spendable.appSpendableUsd, spendable.externalSpendableUsd, pickFundingSource],
  );

  const displayWallet = useMemo(
    () => ({
      ...wallet,
      spendableUsd: effectiveSpendable,
      appSpendableUsd: spendable.appSpendableUsd,
      externalSpendableUsd: spendable.externalSpendableUsd,
      loaded: spendable.loaded,
      fundingSource: pickFundingSource(25),
    }),
    [wallet, effectiveSpendable, spendable.appSpendableUsd, spendable.externalSpendableUsd, spendable.loaded, pickFundingSource],
  );

  return (
    <DiscoverActionsContext.Provider value={value}>
      {children}
      <DiscoverFundSheet
        open={Boolean(fundSheet)}
        request={fundSheet}
        wallet={displayWallet}
        busy={busy}
        fundProgress={fundProgress}
        onClose={() => {
          setFundSheet(null);
          setFundOutcome(null);
          resetFundProgress();
        }}
        fundOutcome={
          fundOutcome
            ? {
                title: buildFundOutcomeTitle({
                  amountUsd: fundOutcome.amountUsd,
                  programName: fundOutcome.programName ?? fundOutcome.label,
                  communitySlug: fundOutcome.communitySlug,
                }),
                summary: buildFundOutcomeSummary({
                  amountUsd: fundOutcome.amountUsd,
                  programName: fundOutcome.programName ?? fundOutcome.label,
                  communitySlug: fundOutcome.communitySlug,
                  programId: fundOutcome.programId,
                }),
                amountUsd: fundOutcome.amountUsd,
                programName: fundOutcome.programName ?? fundOutcome.label,
                communitySlug: fundOutcome.communitySlug,
                programId: fundOutcome.programId,
                whoBenefits: fundOutcome.whoBenefits,
                whyFund: fundOutcome.whyFund,
                steps: fundOutcomeSteps({
                  amountUsd: fundOutcome.amountUsd,
                  communitySlug: fundOutcome.communitySlug,
                  programId: fundOutcome.programId,
                  activityId: fundOutcome.activityId,
                  txHash: fundOutcome.txHash,
                  programName: fundOutcome.programName ?? fundOutcome.label,
                  whyFund: fundOutcome.whyFund,
                  whoBenefits: fundOutcome.whoBenefits,
                }),
                onDeployArc:
                  fundOutcome.communitySlug && fundOutcome.programId
                    ? () => void handleDeployFromFundOutcome()
                    : undefined,
                deployingArc,
              }
            : null
        }
        onConfirm={(amountUsd, fundingSource) => {
          if (!fundSheet) return;
          void executeFund({ ...fundSheet, amountUsd }, "fund-sheet", fundingSource);
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
