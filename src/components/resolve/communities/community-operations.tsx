"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useSpendableUsd } from "@/hooks/use-spendable-usd";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { DiscoverFundSheet } from "@/components/resolve/discover/discover-fund-sheet";
import {
  apiCreateProgram,
  apiFundProgram,
  apiResolveFundTarget,
  apiInstallCommunity,
  type FundSheetRequest,
  type WalletSnapshot,
} from "@/lib/discover/discover-action-engine";
import { defaultProgramTemplateForCommunity } from "@/lib/discover/community-strip-actions";
import { queryKeys } from "@/lib/query/keys";

export function useCommunityOperationsHandlers(slug: string) {
  const queryClient = useQueryClient();
  const spendable = useSpendableUsd();
  const { externalWalletReady, fundProgramWithWallet, pickFundingSource } = useResolveAccess();
  const [busy, setBusy] = useState(false);
  const [fundSheet, setFundSheet] = useState<FundSheetRequest | null>(null);

  const wallet: WalletSnapshot = useMemo(
    () => ({
      spendableUsd: spendable.spendableUsd,
      appSpendableUsd: spendable.appSpendableUsd,
      externalSpendableUsd: spendable.externalSpendableUsd,
      totalUsdc: String(spendable.totalUsdc),
      loaded: spendable.loaded,
      address: spendable.walletAddress,
    }),
    [spendable],
  );

  const invalidateSurface = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["communities", "surface", slug] });
    await queryClient.invalidateQueries({ queryKey: queryKeys.communities });
    await queryClient.invalidateQueries({ queryKey: queryKeys.capitalState });
    await queryClient.invalidateQueries({ queryKey: queryKeys.capitalWallet });
  }, [queryClient, slug]);

  const createProgram = useCallback(
    async (communitySlug: string, templateId?: string) => {
      setBusy(true);
      try {
        const tpl = templateId ?? defaultProgramTemplateForCommunity(communitySlug);
        await apiInstallCommunity(communitySlug).catch(() => null);
        const created = await apiCreateProgram(communitySlug, tpl);
        toast.success(`Program created: ${created.program?.name ?? tpl}`);
        await invalidateSurface();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not create program");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [invalidateSurface],
  );

  const executeFund = useCallback(
    async (req: FundSheetRequest & { amountUsd: number }) => {
      if (req.amountUsd < 5) {
        throw new Error("Amount can't be less than $5");
      }
      const source = pickFundingSource(req.amountUsd);
      const walletSpendable = spendable.spendableUsd;
      const walletReady = spendable.loaded;
      if (!source && walletReady) {
        throw new Error(
          walletSpendable <= 0
            ? "No spendable USDC — add funds in Capital or connect a wallet with Arc USDC"
            : `Insufficient balance: $${walletSpendable.toFixed(2)} available`,
        );
      }

      setBusy(true);
      try {
        let programId = req.programId;
        if (!programId) {
          const target = await apiResolveFundTarget({
            programId: req.programId,
            communitySlug: req.communitySlug ?? slug,
            templateId: req.templateId,
            missionId: req.missionId,
          });
          if (target.needsInstall) await apiInstallCommunity(target.communitySlug);
          if (target.needsCreate || !target.programId) {
            const created = await apiCreateProgram(target.communitySlug, target.templateId);
            programId = created.program?.id;
          } else {
            programId = target.programId;
          }
        }
        if (!programId) throw new Error("No program to fund");

        const fundingSource = source ?? pickFundingSource(req.amountUsd);
        if (!fundingSource) throw new Error("No wallet with enough USDC for this amount");

        if (fundingSource === "external") {
          await fundProgramWithWallet(programId, req.amountUsd);
        } else {
          await apiFundProgram(programId, req.amountUsd);
        }
        toast.success(`$${req.amountUsd.toFixed(2)} added to pool`);
        setFundSheet(null);
        await spendable.refresh().catch(() => null);
        await invalidateSurface();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Fund failed");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [spendable, slug, invalidateSurface, externalWalletReady, fundProgramWithWallet, pickFundingSource],
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
      onClose={() => ops.setFundSheet(null)}
      onConfirm={(amountUsd) => {
        if (!ops.fundSheet) return;
        void ops.executeFund({
          ...ops.fundSheet,
          communitySlug: ops.fundSheet.communitySlug ?? slug,
          amountUsd,
        });
      }}
    />
  );
}
