"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

/** Full-width decision artifact — not chat bubble chrome. */
export function MissionArtifactStage({
  children,
  label = "Decision artifact",
  className,
}: {
  children: ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <section
      className={clsx("w-full", className)}
      aria-label={label}
      data-testid="mission-artifact-stage"
    >
      {children}
    </section>
  );
}

/** Compact user order line — replaces chat bubble for prompts. */
export function MissionPromptLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 border-l-2 border-sky-500/40 pl-3 py-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
        You
      </p>
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-white/90">{children}</p>
    </div>
  );
}

/** Collapsed prior turn — keeps history without chat noise. */
export function MissionPriorTurn({
  prompt,
  summary,
}: {
  prompt: string;
  summary?: string;
}) {
  return (
    <details className="group rounded-lg border border-white/[0.05] bg-white/[0.02] text-xs">
      <summary className="cursor-pointer list-none px-3 py-2 text-resolve-muted marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-resolve-muted-dim">Earlier · </span>
        <span className="text-white/80">{summary ?? prompt.slice(0, 72)}</span>
      </summary>
      <p className="border-t border-white/[0.05] px-3 py-2 text-resolve-muted">{prompt}</p>
    </details>
  );
}
