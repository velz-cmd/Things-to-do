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
};

/** Opens Mission with this opportunity — fund scope or agent intel. */
export function DiscoverSolveButton({ gap, className, onSolve }: DiscoverSolveButtonProps) {
  const intent = solveIntentForGap(gap);
  const fundHref = discoverToMissionHref({
    scope: gap.headline.split(" — ")[0] ?? gap.id,
    intent: "fund",
  });
  const intelHref = `/mission?service=${encodeURIComponent(intent.serviceId)}&prompt=${encodeURIComponent(intent.prompt)}`;

  return (
    <div className={clsx("flex flex-wrap gap-2", className)}>
      <Link
        href={fundHref}
        onClick={() => onSolve?.()}
        title="Mission decides allocation for this community"
        className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-[12px] font-semibold text-sky-100 transition hover:bg-sky-500/20"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Fund in Mission
      </Link>
      <Link
        href={intelHref}
        onClick={() => onSolve?.()}
        title="Open Mission with this opportunity ready for analysis"
        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[12px] font-semibold text-violet-100 transition hover:bg-violet-500/20"
      >
        {intent.label}
      </Link>
    </div>
  );
}
