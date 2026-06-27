"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import type { OsQuestionAnswer } from "@/lib/workspace/economic-os";

/** Hero briefing — one headline, intelligence bullets from real sensors. */
export function EconomicBriefing({
  headline,
  answers,
  loading,
}: {
  headline: string;
  answers: OsQuestionAnswer[];
  loading?: boolean;
}) {
  const insights = answers
    .filter((a) => !a.empty && a.id !== "value_happening")
    .flatMap((a) => a.bullets.slice(0, 2))
    .slice(0, 5);

  if (loading) {
    return (
      <BlueGlowCard className="p-10 text-center" grid={false}>
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-resolve-border border-t-resolve-accent" />
        <p className="mt-4 text-sm text-resolve-muted">Reading economic graph…</p>
      </BlueGlowCard>
    );
  }

  return (
    <BlueGlowCard className="overflow-hidden p-0" padding={false} grid={false}>
      <div
        className="border-b border-resolve-border px-6 py-5 md:px-8 md:py-6"
        style={{
          background:
            "linear-gradient(135deg, rgba(0,122,255,0.12) 0%, transparent 55%)",
        }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Economic operating system
        </p>
        <p className="mt-3 text-xl font-semibold leading-snug tracking-tight text-white md:text-2xl">
          {headline}
        </p>
        {insights.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {insights.map((line) => (
              <li key={line} className="flex gap-2 text-sm text-resolve-muted">
                <span className="text-resolve-accent-bright">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="grid divide-resolve-border/60 md:grid-cols-3 md:divide-x">
        {answers
          .filter((a) => a.metric)
          .slice(0, 3)
          .map((a) => (
            <div key={a.id} className="px-6 py-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-resolve-muted-dim">
                {a.metric!.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-white">{a.metric!.value}</p>
            </div>
          ))}
      </div>
    </BlueGlowCard>
  );
}
