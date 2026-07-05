import type { FundingSource } from "@/lib/wallet/funding-source";

export type FundProgressStage =
  | "idle"
  | "preparing_pool"
  | "checking_wallet"
  | "awaiting_signature"
  | "arc_broadcast"
  | "arc_confirming"
  | "recording_stake"
  | "complete"
  | "error";

export type FundProgressState = {
  stage: FundProgressStage;
  message?: string;
  txHash?: string;
  fundingSource?: FundingSource;
  amountUsd?: number;
  programId?: string;
};

export const FUND_PROGRESS_STEPS: Array<{
  stage: FundProgressStage;
  label: string;
  detail: string;
}> = [
  {
    stage: "preparing_pool",
    label: "Prepare pool",
    detail: "Install community & create program if needed",
  },
  {
    stage: "checking_wallet",
    label: "Check wallet",
    detail: "Arc testnet USDC balance on your chosen wallet",
  },
  {
    stage: "awaiting_signature",
    label: "Sign in wallet",
    detail: "Confirm USDC transfer on Arc testnet",
  },
  {
    stage: "arc_broadcast",
    label: "Broadcast",
    detail: "Transaction submitted to Arc testnet",
  },
  {
    stage: "arc_confirming",
    label: "Arc confirmation",
    detail: "Waiting for on-chain USDC receipt",
  },
  {
    stage: "recording_stake",
    label: "Record stake",
    detail: "Saving your pool contribution to RESOLVE",
  },
  {
    stage: "complete",
    label: "Funded",
    detail: "Your USDC is in the pool",
  },
];

export function fundStepsForSource(source: FundingSource): FundProgressStage[] {
  if (source === "external") {
    return [
      "preparing_pool",
      "checking_wallet",
      "awaiting_signature",
      "arc_broadcast",
      "arc_confirming",
      "recording_stake",
      "complete",
    ];
  }
  return ["preparing_pool", "checking_wallet", "recording_stake", "arc_confirming", "complete"];
}

export function stageIndex(stage: FundProgressStage, source: FundingSource): number {
  const steps = fundStepsForSource(source);
  const idx = steps.indexOf(stage);
  return idx === -1 ? 0 : idx;
}

export function stageLabel(stage: FundProgressStage): string {
  return FUND_PROGRESS_STEPS.find((s) => s.stage === stage)?.label ?? stage;
}
