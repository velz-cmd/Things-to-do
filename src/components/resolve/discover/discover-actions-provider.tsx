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
import { useDiscoverActionAudit } from "@/components/resolve/discover/discover-action-audit-panel";
import { useCommunityConsoleOptional } from "@/components/resolve/discover/discover-community-console-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { tailorDiscoverActionsForUser } from "@/lib/discover/tailor-actions-for-user";
import type { CommunityConsoleActionContext } from "@/components/resolve/discover/discover-community-console-provider";
import { communitySlugFromDiscoverTarget } from "@/lib/discover/discover-inline-target";

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

export function DiscoverActionsProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const communityConsole = useCommunityConsoleOptional();
  const { balance, balanceLoading, refreshBalance } = useAuth();
  const { state: connections, reload: reloadConnections } = useUserConnections();
  const { reportActionStatus } = useDiscoverActionAudit();
  const [wallet, setWallet] = useState<WalletSnapshot>({
    spendableUsd: 0,
    totalUsdc: "0",
    loaded: false,
  });
  const [busy, setBusy] = useState(false);
  const [fundSheet, setFundSheet] = useState<FundSheetRequest | null>(null);

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

  const openDiscoverConsole = useCallback(
    (
      communitySlug: string,
      actionContext?: CommunityConsoleActionContext,
      label?: string,
    ) => {
      if (!communityConsole) {
        toast.error("Community console unavailable — refresh Discover");
        return;
      }
      communityConsole.open({
        communitySlug,
        tab: "console",
        actionContext,
        label,
      });
    },
    [communityConsole],
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

      toast.loading(`Creating ${target.templateId} program…`, { id: "discover-chain" });
      const created = await apiCreateProgram(target.communitySlug, target.templateId);
      toast.dismiss("discover-chain");
      if (!created.program?.id) throw new Error("Program was not created — POST /api/communities/{slug}/programs returned no id");
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
          const target = await apiResolveFundTarget({
            programId: req.programId,
            communitySlug: req.communitySlug,
            templateId: req.templateId,
            missionId: req.missionId,
          });
          programId = await ensureProgram(target);
        }

        toast.loading(`Funding $${req.amountUsd.toFixed(2)} via POST /api/capital/fund…`, {
          id: "discover-chain",
        });
        await apiFundProgram(programId, req.amountUsd);
        toast.success(`Funded $${req.amountUsd.toFixed(2)} — obligations clearing`, {
          id: "discover-chain",
        });
        reportActionStatus(surface, auditAction, "success");
        await refreshBalance().catch(() => null);
        await refreshWallet();
        setFundSheet(null);
        if (req.communitySlug) {
          openDiscoverConsole(req.communitySlug, "fund", req.label);
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
    [signedIn, router, wallet, ensureProgram, refreshWallet, refreshBalance, reportActionStatus, openDiscoverConsole],
  );

  const openFundSheet = useCallback(
    (req: FundSheetRequest) => {
      if (!signedIn) {
        router.push("/login?next=/discover");
        return;
      }
      if (wallet.loaded && wallet.spendableUsd <= 0) {
        toast.error("No spendable USDC — add funds in Capital before funding");
        return;
      }
      setFundSheet(req);
    },
    [signedIn, router, wallet.loaded, wallet.spendableUsd],
  );

  const runAction = useCallback(
    async (rawAction: DiscoverAction, surface = "discover") => {
      const [action = rawAction] = tailorDiscoverActionsForUser([rawAction], connections);
      const authRequired = [
        "fund",
        "install",
        "create_program",
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

      reportActionStatus(surface, action, "pending");

      try {
        switch (action.kind) {
          case "open": {
            const inlineSlug =
              communitySlugFromDiscoverTarget(action.entityPath) ??
              communitySlugFromDiscoverTarget(action.href);
            if (inlineSlug && communityConsole) {
              openDiscoverConsole(inlineSlug, "observe", action.label);
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
            openDiscoverConsole(slug, "observe", action.label);
            reportActionStatus(surface, action, "success");
            break;
          }

          case "install": {
            const slug = action.communitySlug!;
            const toastId = `discover-install-${slug}`;
            toast.loading(`Setting up ${slug}…`, { id: toastId });
            try {
              const result = await apiInstallCommunity(slug);
              toast.success(
                result.alreadyInstalled
                  ? `${slug} ready — console open`
                  : `${slug} ready — syncing in background`,
                { id: toastId },
              );
              reportActionStatus(surface, action, "success");
              void reloadConnections();
              if (surface !== "community-console" && surface !== "bubble-operator-panel") {
                openDiscoverConsole(slug, "install");
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Attach failed";
              reportActionStatus(surface, action, "error", msg);
              toast.error(msg, { id: toastId });
              throw e;
            }
            break;
          }

          case "create_program": {
            const slug = action.communitySlug!;
            const toastId = `discover-program-${slug}`;
            toast.loading(`Setting up ${slug}…`, { id: toastId });
            try {
              try {
                await apiInstallCommunity(slug);
              } catch (e) {
                const msg = e instanceof Error ? e.message : "";
                if (!msg.toLowerCase().includes("already")) throw e;
              }
              const created = await apiCreateProgram(slug, action.templateId);
              if (!created.program?.id) {
                throw new Error("Program not created — check community attach and templateId");
              }
              toast.success(`Program created: ${created.program.name}`, { id: toastId });
              reportActionStatus(surface, action, "success");
              void reloadConnections();
              if (surface !== "community-console" && surface !== "bubble-operator-panel") {
                openDiscoverConsole(slug, "create_program");
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Create program failed";
              reportActionStatus(surface, action, "error", msg);
              toast.error(msg, { id: toastId });
              throw e;
            }
            break;
          }

          case "connect_sensor": {
            const slug = action.communitySlug ?? action.href?.match(/\/communities\/([^/#?]+)/)?.[1];
            if (!slug) {
              if (action.href) {
                router.push(action.href);
                reportActionStatus(surface, action, "success");
              }
              break;
            }
            const toastId = `discover-sensor-${slug}`;
            toast.loading(`Setting up ${slug}…`, { id: toastId });
            try {
              await apiInstallCommunity(slug);
              toast.success(`${slug} ready — syncing value automatically`, { id: toastId });
              reportActionStatus(surface, action, "success");
              void reloadConnections();
              openDiscoverConsole(slug, "install");
            } catch (e) {
              const msg = e instanceof Error ? e.message : "Could not attach community";
              reportActionStatus(surface, action, "error", msg);
              toast.error(msg, { id: toastId });
            }
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

          case "analyze": {
            const inlineSlug =
              communitySlugFromDiscoverTarget(action.entityPath) ??
              communitySlugFromDiscoverTarget(action.href) ??
              action.communitySlug ??
              null;
            if (inlineSlug && communityConsole) {
              openDiscoverConsole(inlineSlug, "observe", action.label);
              reportActionStatus(surface, action, "success");
              break;
            }
            if (action.href) {
              router.push(action.href);
              reportActionStatus(surface, action, "success");
            } else if (action.entityPath) {
              router.push(action.entityPath);
              reportActionStatus(surface, action, "success");
            } else if (action.serviceId) {
              const prompt =
                action.label ? `Run intel on ${action.label}` : "Run agent signal on this opportunity";
              router.push(
                `/mission?service=${encodeURIComponent(action.serviceId)}&prompt=${encodeURIComponent(prompt)}`,
              );
              reportActionStatus(surface, action, "success");
            }
            break;
          }

          case "automate":
            if (action.communitySlug && communityConsole) {
              communityConsole.open({
                communitySlug: action.communitySlug,
                tab: "automate",
                automationTrigger: action.automationTrigger,
              });
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
    [signedIn, router, executeFund, openFundSheet, reportActionStatus, communityConsole, connections, openDiscoverConsole, reloadConnections],
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
