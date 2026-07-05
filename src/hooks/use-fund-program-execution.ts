"use client";

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { recordFundAction } from "@/lib/capital/fund-action-store";
import type { FundProgressState } from "@/lib/capital/fund-progress";
import {
  apiCreateProgram,
  apiFundProgram,
  apiInstallCommunity,
  apiResolveFundTarget,
  type FundSheetRequest,
} from "@/lib/discover/discover-action-engine";
import { queryKeys } from "@/lib/query/keys";
import { useSpendableUsd } from "@/hooks/use-spendable-usd";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import {
  affordableFundingSources,
  pickFundingSource,
  type FundingSource,
} from "@/lib/wallet/funding-source";

const IDLE_PROGRESS: FundProgressState = { stage: "idle" };

export function useFundProgramExecution(defaultCommunitySlug?: string) {
  const queryClient = useQueryClient();
  const spendable = useSpendableUsd();
  const { externalWalletReady, fundProgramWithWallet } = useResolveAccess();
  const [fundProgress, setFundProgress] = useState<FundProgressState>(IDLE_PROGRESS);

  const resetFundProgress = useCallback(() => {
    setFundProgress(IDLE_PROGRESS);
  }, []);

  const executeFund = useCallback(
    async (
      req: FundSheetRequest & { amountUsd: number },
      chosenSource?: FundingSource | null,
    ) => {
      if (req.amountUsd < 5) {
        throw new Error("Amount can't be less than $5");
      }

      const balances = {
        appSpendableUsd: spendable.appSpendableUsd,
        externalSpendableUsd: spendable.externalSpendableUsd,
      };
      const source =
        chosenSource ??
        pickFundingSource(req.amountUsd, balances, externalWalletReady);

      if (!source && spendable.loaded) {
        throw new Error(
          spendable.spendableUsd <= 0
            ? "No spendable USDC — add funds in Capital or connect a wallet with Arc USDC"
            : `Insufficient balance across wallets — need $${req.amountUsd.toFixed(2)}`,
        );
      }
      if (!source) {
        throw new Error("Pick a wallet with enough Arc testnet USDC");
      }

      const affordable = affordableFundingSources(
        req.amountUsd,
        balances,
        externalWalletReady,
      );
      if (!affordable.includes(source)) {
        throw new Error(`Selected wallet cannot cover $${req.amountUsd.toFixed(2)}`);
      }

      setFundProgress({
        stage: "preparing_pool",
        fundingSource: source,
        amountUsd: req.amountUsd,
      });

      try {
        let programId = req.programId;
        const communitySlug = req.communitySlug ?? defaultCommunitySlug;

        if (!programId) {
          const target = await apiResolveFundTarget({
            programId: req.programId,
            communitySlug,
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

        setFundProgress((p) => ({
          ...p,
          stage: "checking_wallet",
          programId,
        }));

        let txHash: string | undefined;

        if (source === "external") {
          setFundProgress((p) => ({ ...p, stage: "awaiting_signature" }));
          const result = await fundProgramWithWallet(programId, req.amountUsd, {
            onStage: (stage, hash) => {
              setFundProgress((p) => ({
                ...p,
                stage,
                txHash: hash ?? p.txHash,
              }));
            },
          });
          txHash = result.txHash;
        } else {
          setFundProgress((p) => ({ ...p, stage: "recording_stake" }));
          await apiFundProgram(programId, req.amountUsd);
          setFundProgress((p) => ({ ...p, stage: "arc_confirming" }));
        }

        recordFundAction({
          programId,
          communitySlug,
          programName: req.label,
          amountUsd: req.amountUsd,
          fundingSource: source,
          txHash,
        });

        setFundProgress((p) => ({
          ...p,
          stage: "complete",
          txHash,
          programId,
        }));

        await spendable.refresh().catch(() => null);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.capitalState }),
          queryClient.invalidateQueries({ queryKey: queryKeys.myPoolStakes }),
          queryClient.invalidateQueries({ queryKey: queryKeys.communities }),
          queryClient.invalidateQueries({ queryKey: queryKeys.discoverRadarFeed() }),
          communitySlug
            ? queryClient.invalidateQueries({
                queryKey: queryKeys.communitySurface(communitySlug),
              })
            : Promise.resolve(),
        ]).catch(() => null);

        return {
          programId,
          amountUsd: req.amountUsd,
          fundingSource: source,
          txHash,
          message: `You funded this pool $${req.amountUsd.toFixed(2)}`,
        };
      } catch (e) {
        setFundProgress((p) => ({
          ...p,
          stage: "error",
          message: e instanceof Error ? e.message : "Fund failed",
        }));
        throw e;
      }
    },
    [
      spendable,
      externalWalletReady,
      fundProgramWithWallet,
      defaultCommunitySlug,
      queryClient,
    ],
  );

  return {
    fundProgress,
    resetFundProgress,
    executeFund,
    externalWalletReady,
    spendable,
  };
}
