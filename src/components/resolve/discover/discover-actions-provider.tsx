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

type DiscoverActionsContextValue = {
  signedIn: boolean;
  wallet: WalletSnapshot;
  busy: boolean;
  runAction: (action: DiscoverAction) => Promise<void>;
  openFundSheet: (req: FundSheetRequest) => void;
  refreshWallet: () => Promise<void>;
  executeFund: (req: FundSheetRequest & { amountUsd: number }) => Promise<void>;
};

const DiscoverActionsContext = createContext<DiscoverActionsContextValue | null>(null);

export function DiscoverActionsProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
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
    const snap = await apiFetchWallet();
    setWallet(snap);
  }, [signedIn]);

  useEffect(() => {
    void refreshWallet();
  }, [refreshWallet]);

  const ensureProgram = useCallback(
    async (target: {
      programId: string | null;
      communitySlug: string;
      templateId: string;
      needsInstall: boolean;
    }) => {
      if (target.programId) return target.programId;

      if (target.needsInstall) {
        toast.loading(`Installing ${target.communitySlug}…`, { id: "discover-chain" });
        await apiInstallCommunity(target.communitySlug);
      }

      toast.loading(`Creating ${target.templateId} program…`, { id: "discover-chain" });
      const created = await apiCreateProgram(target.communitySlug, target.templateId);
      if (!created.program?.id) throw new Error("Program was not created");
      return created.program.id;
    },
    [],
  );

  const executeFund = useCallback(
    async (req: FundSheetRequest & { amountUsd: number }) => {
      if (!signedIn) {
        router.push("/login?next=/discover");
        return;
      }

      if (req.amountUsd < 5) {
        throw new Error("Enter at least $5");
      }

      if (wallet.loaded && wallet.spendableUsd > 0 && req.amountUsd > wallet.spendableUsd) {
        throw new Error(
          `Insufficient wallet balance ($${wallet.spendableUsd.toFixed(2)} spendable)`,
        );
      }

      setBusy(true);
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

        toast.loading(`Funding $${req.amountUsd.toFixed(2)}…`, { id: "discover-chain" });
        await apiFundProgram(programId, req.amountUsd);
        toast.success(`Funded $${req.amountUsd.toFixed(2)} — obligations clearing`, {
          id: "discover-chain",
        });
        await refreshWallet();
        setFundSheet(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Fund failed", { id: "discover-chain" });
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [signedIn, router, wallet, ensureProgram, refreshWallet],
  );

  const openFundSheet = useCallback((req: FundSheetRequest) => {
    if (!signedIn) {
      router.push("/login?next=/discover");
      return;
    }
    setFundSheet(req);
  }, [signedIn, router]);

  const runAction = useCallback(
    async (action: DiscoverAction) => {
      const authRequired = [
        "fund",
        "install",
        "create_program",
        "claim",
        "connect_sensor",
        "sponsor",
      ];
      if (!signedIn && authRequired.includes(action.kind)) {
        router.push("/login?next=/discover");
        return;
      }

      try {
        switch (action.kind) {
          case "open":
            if (action.entityPath) router.push(action.entityPath);
            else if (action.href) {
              if (action.href.startsWith("#")) {
                document.getElementById(action.href.slice(1))?.scrollIntoView({ behavior: "smooth" });
              } else router.push(action.href);
            }
            break;

          case "fund":
          case "sponsor":
            if (action.programId || action.communitySlug || action.missionId) {
              if (action.amountUsd && action.amountUsd >= 5 && action.programId) {
                await executeFund({
                  programId: action.programId,
                  amountUsd: action.amountUsd,
                  label: action.label,
                });
              } else {
                openFundSheet(fundParamsFromAction(action));
              }
            } else {
              toast.error("No program linked — create a community program first");
            }
            break;

          case "install":
            if (!action.communitySlug) break;
            setBusy(true);
            try {
              await apiInstallCommunity(action.communitySlug);
              toast.success(`Connected to ${action.communitySlug}`);
              router.push(`/communities/${action.communitySlug}`);
            } finally {
              setBusy(false);
            }
            break;

          case "create_program": {
            if (!action.communitySlug) break;
            setBusy(true);
            try {
              try {
                await apiInstallCommunity(action.communitySlug);
              } catch (e) {
                const msg = e instanceof Error ? e.message : "";
                if (!msg.toLowerCase().includes("already")) throw e;
              }
              const created = await apiCreateProgram(action.communitySlug, action.templateId);
              toast.success(`Program created — ${created.program?.name ?? "active"}`);
              router.push(`/communities/${action.communitySlug}`);
            } finally {
              setBusy(false);
            }
            break;
          }

          case "connect_sensor":
            router.push(action.href ?? `/communities/${action.communitySlug ?? "react"}`);
            break;

          case "claim":
            router.push(action.href ?? "/claim");
            break;

          case "share":
            if (action.href) {
              setBusy(true);
              try {
                const url = await apiVerifyAndShareReceipt(action.href, window.location.origin);
                toast.success("Receipt link copied", { description: url });
              } finally {
                setBusy(false);
              }
            }
            break;

          case "analyze":
            if (action.entityPath) router.push(action.entityPath);
            break;

          default:
            if (action.href) router.push(action.href);
        }
      } catch (e) {
        if (action.kind !== "fund" && action.kind !== "sponsor") {
          toast.error(e instanceof Error ? e.message : "Action failed");
        }
      }
    },
    [signedIn, router, executeFund, openFundSheet],
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
