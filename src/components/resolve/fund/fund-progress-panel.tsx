"use client";

import clsx from "clsx";
import { Check, Loader2 } from "lucide-react";
import {
  fundStepsForSource,
  stageIndex,
  type FundProgressStage,
} from "@/lib/capital/fund-progress";
import type { FundingSource } from "@/lib/wallet/funding-source";

type FundProgressPanelProps = {
  stage: FundProgressStage;
  fundingSource: FundingSource;
  amountUsd?: number;
  txHash?: string;
};

const STEP_COPY: Record<FundProgressStage, { title: string; sub: string }> = {
  idle: { title: "Ready", sub: "" },
  preparing_pool: {
    title: "Preparing pool",
    sub: "Setting up community program on Arc testnet",
  },
  checking_wallet: {
    title: "Checking wallet",
    sub: "Verifying Arc testnet USDC on your chosen wallet",
  },
  awaiting_signature: {
    title: "Confirm in your wallet",
    sub: "Approve USDC transfer on Arc testnet",
  },
  arc_broadcast: {
    title: "Broadcasting",
    sub: "Submitting transaction to Arc testnet",
  },
  arc_confirming: {
    title: "Arc confirmation",
    sub: "Waiting for on-chain USDC receipt",
  },
  recording_stake: {
    title: "Recording stake",
    sub: "Saving your contribution to this pool",
  },
  complete: {
    title: "Funded on Arc",
    sub: "USDC is in the pool — visible in Capital activity",
  },
  error: { title: "Could not complete", sub: "Try again or open Capital for status" },
};

export function FundProgressPanel({
  stage,
  fundingSource,
  amountUsd,
  txHash,
}: FundProgressPanelProps) {
  if (stage === "idle") return null;

  const steps = fundStepsForSource(fundingSource).filter((s) => s !== "complete");
  const activeIdx = stageIndex(stage, fundingSource);
  const isComplete = stage === "complete";
  const isError = stage === "error";

  return (
    <div
      className="mt-3 overflow-hidden rounded-xl border border-resolve-accent/25 bg-gradient-to-b from-resolve-accent/[0.08] to-black/30"
      aria-live="polite"
      aria-busy={!isComplete && !isError}
    >
      <div className="border-b border-white/[0.06] px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-accent">
          Funding on Arc testnet
        </p>
        <p className="mt-0.5 text-sm font-medium text-white">
          {STEP_COPY[stage].title}
          {amountUsd != null && amountUsd >= 5 && (
            <span className="ml-1.5 tabular-nums text-resolve-muted">
              · ${amountUsd.toFixed(2)} USDC
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11px] text-resolve-muted">{STEP_COPY[stage].sub}</p>
        {txHash && (
          <a
            href={`https://testnet.arcscan.app/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block font-mono text-[10px] text-resolve-accent hover:underline"
          >
            View tx {txHash.slice(0, 10)}…
          </a>
        )}
      </div>

      <ol className="space-y-0 px-3 py-3">
        {steps.map((step, i) => {
          const done = isComplete || i < activeIdx;
          const active = !isComplete && !isError && i === activeIdx;
          const copy = STEP_COPY[step];
          return (
            <li key={step} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={clsx(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px]",
                    done && "border-emerald-400/50 bg-emerald-500/20 text-emerald-200",
                    active && "border-resolve-accent bg-resolve-accent/20 text-resolve-accent",
                    !done && !active && "border-white/10 bg-black/30 text-resolve-muted-dim",
                  )}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </span>
                {i < steps.length - 1 && (
                  <span
                    className={clsx(
                      "my-0.5 w-px flex-1 min-h-[12px]",
                      done ? "bg-emerald-500/40" : "bg-white/10",
                    )}
                  />
                )}
              </div>
              <div className={clsx("pb-3", i === steps.length - 1 && "pb-0")}>
                <p
                  className={clsx(
                    "text-xs font-medium",
                    done ? "text-emerald-200" : active ? "text-white" : "text-resolve-muted-dim",
                  )}
                >
                  {copy.title}
                </p>
                <p className="text-[10px] text-resolve-muted-dim">{copy.sub}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {isComplete && (
        <div className="border-t border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-center text-[11px] font-medium text-emerald-200">
          Pool funded — badge saved to your account
        </div>
      )}
    </div>
  );
}
