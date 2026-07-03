"use client";

import clsx from "clsx";
import { Sparkles } from "lucide-react";
import type { TrendingValueGap } from "@/lib/discover/types";
import { solveIntentForGap } from "@/lib/discover/solve-intents";
import { useDiscoverSolveOptional } from "@/components/resolve/discover/discover-solve-provider";

type DiscoverSolveButtonProps = {
  gap: TrendingValueGap;
  className?: string;
  onSolve?: () => void;
};

/**
 * "Solve with AI" — hands the card's problem to the Agent Signal Market
 * (problem → agent → recommendation → Approve). No-op render when the
 * solve provider is absent (e.g. standalone card previews).
 */
export function DiscoverSolveButton({ gap, className, onSolve }: DiscoverSolveButtonProps) {
  const solve = useDiscoverSolveOptional();
  if (!solve) return null;

  const intent = solveIntentForGap(gap);

  return (
    <button
      type="button"
      onClick={() => {
        solve.requestSolve(intent);
        onSolve?.();
      }}
      title="Run a paid AI agent on this opportunity and get a fundable recommendation"
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[12px] font-semibold text-violet-100 transition hover:bg-violet-500/20",
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {intent.label}
    </button>
  );
}
