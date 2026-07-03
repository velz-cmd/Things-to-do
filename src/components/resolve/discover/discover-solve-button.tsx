"use client";

import clsx from "clsx";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { TrendingValueGap } from "@/lib/discover/types";
import { solveIntentForGap } from "@/lib/discover/solve-intents";

type DiscoverSolveButtonProps = {
  gap: TrendingValueGap;
  className?: string;
  onSolve?: () => void;
};

/** Opens Mission with this opportunity and the right analysis prompt. */
export function DiscoverSolveButton({ gap, className, onSolve }: DiscoverSolveButtonProps) {
  const intent = solveIntentForGap(gap);
  const href = `/mission?service=${encodeURIComponent(intent.serviceId)}&prompt=${encodeURIComponent(intent.prompt)}`;

  return (
    <Link
      href={href}
      onClick={() => onSolve?.()}
      title="Open Mission with this opportunity ready for analysis"
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-[12px] font-semibold text-violet-100 transition hover:bg-violet-500/20",
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5" />
      {intent.label}
    </Link>
  );
}
