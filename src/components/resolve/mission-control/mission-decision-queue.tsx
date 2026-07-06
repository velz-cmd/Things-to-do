"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Sparkles, Star } from "lucide-react";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import {
  formatDecisionUsd,
  gapsToMissionDecisions,
  type MissionDecision,
} from "@/lib/mission/mission-recommended-decisions";
import type { TrendingValueGap } from "@/lib/discover/types";

function StarRow({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${count} star priority`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={clsx(
            "h-3 w-3",
            i < count ? "fill-amber-300 text-amber-300" : "text-white/15",
          )}
          aria-hidden
        />
      ))}
    </span>
  );
}

function DecisionCard({
  decision,
  onSelect,
  disabled,
}: {
  decision: MissionDecision;
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  return (
    <DiscoverCapitalCard
      as="button"
      type="button"
      accent="amber"
      className={clsx("mission-decision-card text-left", disabled && "opacity-50")}
      onClick={() => !disabled && onSelect(decision.prompt)}
      title={decision.prompt}
      hover={!disabled}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">{decision.title}</p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-resolve-muted">
            {decision.subtitle}
          </p>
        </div>
        <StarRow count={decision.stars} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-resolve-muted">
          Expected impact · {decision.impact}
        </span>
        <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-amber-100">
          Needed · {formatDecisionUsd(decision.neededUsd)}
        </span>
        <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-sky-100">
          {decision.confidence}% confidence
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
          Recommended decision
        </span>
        <span className="mission-btn mission-btn--primary !px-2.5 !py-1 text-[11px]">
          {decision.cta}
        </span>
      </div>
    </DiscoverCapitalCard>
  );
}

export function MissionDecisionQueue({
  onSelectDecision,
  loading,
  limit = 3,
  className,
}: {
  onSelectDecision: (prompt: string) => void;
  loading?: boolean;
  limit?: number;
  className?: string;
}) {
  const [decisions, setDecisions] = useState<MissionDecision[]>(() =>
    gapsToMissionDecisions([], limit),
  );
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "ready">("idle");

  useEffect(() => {
    let cancelled = false;
    setFetchState("loading");

    fetch(`/api/discover/trending?limit=${limit}`)
      .then((r) => r.json())
      .then((body: { gaps?: TrendingValueGap[] }) => {
        if (cancelled) return;
        setDecisions(gapsToMissionDecisions(body.gaps ?? [], limit));
        setFetchState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setDecisions(gapsToMissionDecisions([], limit));
        setFetchState("ready");
      });

    return () => {
      cancelled = true;
    };
  }, [limit]);

  return (
    <section className={clsx("mission-panel mission-decision-queue", className)} aria-label="Recommended decisions">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-200/90">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden />
          Recommended decisions
        </span>
        <span className="text-[10px] text-resolve-muted-dim">
          {fetchState === "loading" ? "Refreshing…" : "Not opportunities — decisions"}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <p className="text-xs leading-relaxed text-resolve-muted">
          A queue of capital decisions ranked by impact. Pick one to open a blueprint, authorize, or
          research a gap — Mission orchestrates the agents.
        </p>

        <div className="grid gap-3 sm:grid-cols-1">
          {decisions.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              onSelect={onSelectDecision}
              disabled={loading}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
