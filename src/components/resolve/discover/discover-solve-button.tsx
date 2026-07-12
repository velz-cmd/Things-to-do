"use client";

import clsx from "clsx";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { TrendingValueGap } from "@/lib/discover/types";
import { solveIntentForGap } from "@/lib/discover/solve-intents";
import { discoverToMissionHref } from "@/lib/mission/mission-handoff";

type DiscoverSolveButtonProps = {
  gap: TrendingValueGap;
  className?: string;
  onSolve?: () => void;
  compact?: boolean;
  mode?: "all" | "mission";
};

export function solveLinksForGap(gap: TrendingValueGap) {
  const intent = solveIntentForGap(gap);
  return {
    fundHref: discoverToMissionHref({
      scope: gap.headline.split(" — ")[0] ?? gap.id,
      intent: "fund",
    }),
    intelHref: `/mission?service=${encodeURIComponent(intent.serviceId)}&prompt=${encodeURIComponent(intent.prompt)}`,
    intelLabel: intent.label,
  };
}

/** Opens Mission with this opportunity — fund scope or agent intel. */
export function DiscoverSolveButton({
  gap,
  className,
  onSolve,
  compact = false,
  mode = "all",
}: DiscoverSolveButtonProps) {
  const { fundHref, intelHref, intelLabel } = solveLinksForGap(gap);

  return (
    <div className={clsx("flex flex-wrap gap-2", className)}>
      <Link
        href={fundHref}
        onClick={() => onSolve?.()}
        title="Mission decides allocation for this community"
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 font-semibold text-sky-100 transition hover:bg-sky-500/20",
          compact ? "min-h-10 px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-[12px]",
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {compact && mode === "mission" ? "Mission" : "Fund in Mission"}
      </Link>
      {mode === "all" && (
        <Link
          href={intelHref}
          onClick={() => onSolve?.()}
          title="Open Mission with this opportunity ready for analysis"
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 font-semibold text-violet-100 transition hover:bg-violet-500/20",
            compact ? "min-h-10 px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-[12px]",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {intelLabel}
        </Link>
      )}
    </div>
  );
}
