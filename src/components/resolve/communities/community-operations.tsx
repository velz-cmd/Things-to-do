"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { DiscoverFundSheet } from "@/components/resolve/discover/discover-fund-sheet";
import {
  apiCreateProgram,
  apiInstallCommunity,
  type FundSheetRequest,
  type WalletSnapshot,
} from "@/lib/discover/discover-action-engine";
import { defaultProgramTemplateForCommunity } from "@/lib/discover/community-strip-actions";
import { useFundProgramExecution } from "@/hooks/use-fund-program-execution";
import type { FundingSource } from "@/lib/wallet/funding-source";

export function useCommunityOperationsHandlers(slug: string) {
  const {
    fundProgress,
    resetFundProgress,
    executeFund: runFund,
    spendable,
  } = useFundProgramExecution(slug);

  const [fundSheet, setFundSheet] = useState<FundSheetRequest | null>(null);
  const [creating, setCreating] = useState(false);

  const busy =
    creating ||
    (fundProgress.stage !== "idle" &&
      fundProgress.stage !== "complete" &&
      fundProgress.stage !== "error");

  const wallet: WalletSnapshot = {
    spendableUsd: spendable.spendableUsd,
    appSpendableUsd: spendable.appSpendableUsd,
    externalSpendableUsd: spendable.externalSpendableUsd,
    totalUsdc: String(spendable.totalUsdc),
    loaded: spendable.loaded,
    address: spendable.walletAddress,
  };

  const createProgram = useCallback(async (communitySlug: string, templateId?: string) => {
    setCreating(true);
    try {
      const tpl = templateId ?? defaultProgramTemplateForCommunity(communitySlug);
      await apiInstallCommunity(communitySlug).catch(() => null);
      const created = await apiCreateProgram(communitySlug, tpl);
      toast.success(`Program created: ${created.program?.name ?? tpl}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create program");
      throw e;
    } finally {
      setCreating(false);
    }
  }, []);

  const executeFund = useCallback(
    async (req: FundSheetRequest & { amountUsd: number }, chosenSource?: FundingSource) => {
      try {
        const result = await runFund(req, chosenSource);
        toast.success(result.message, {
          description: result.txHash ? "Confirmed on Arc testnet" : "Saved to Capital activity",
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Fund failed");
        throw e;
      }
    },
    [runFund],
  );

  const openFundSheet = useCallback((req: FundSheetRequest) => {
    setFundSheet(req);
  }, []);

  const fundProgram = useCallback(
    (programId: string, communitySlug: string, label?: string, amountUsd?: number) => {
      openFundSheet({
        programId,
        communitySlug,
        label: label ?? "Fund program",
        amountUsd,
      });
    },
    [openFundSheet],
  );

  return {
    busy,
    wallet,
    fundProgress,
    resetFundProgress,
    createProgram,
    openFundSheet,
    fundProgram,
    fundSheet,
    setFundSheet,
    executeFund,
  };
}

export function CommunityFundSheetHost({
  slug,
  ops,
}: {
  slug: string;
  ops: ReturnType<typeof useCommunityOperationsHandlers>;
}) {
  return (
    <DiscoverFundSheet
      open={Boolean(ops.fundSheet)}
      request={ops.fundSheet}
      wallet={ops.wallet}
      busy={ops.busy}
      fundProgress={ops.fundProgress}
      onClose={() => {
        ops.setFundSheet(null);
        ops.resetFundProgress();
      }}
      onConfirm={(amountUsd, fundingSource) => {
        if (!ops.fundSheet) return;
        void ops.executeFund(
          {
            ...ops.fundSheet,
            communitySlug: ops.fundSheet.communitySlug ?? slug,
            amountUsd,
          },
          fundingSource,
        );
      }}
    />
  );
}
