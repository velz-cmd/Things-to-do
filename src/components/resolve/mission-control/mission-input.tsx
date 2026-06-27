"use client";

import { useState, type FormEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { MissionQuickActions } from "@/components/resolve/mission-control/mission-quick-actions";
import { quickActionsForCommunity } from "@/lib/mission/community/quick-actions";
import type { CommunityKind } from "@/lib/mission/community";

export function MissionInput({
  value,
  onChange,
  onSubmit,
  loading,
  compact,
  communityKind,
  communityName,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (objective: string) => void;
  loading: boolean;
  compact?: boolean;
  communityKind?: CommunityKind;
  communityName?: string;
}) {
  const [showMore, setShowMore] = useState(false);
  const contextual = communityKind ?
    quickActionsForCommunity(communityKind, communityName)
  : [];

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || loading) return;
    onSubmit(value.trim());
  }

  return (
    <div className={compact ? "border-b border-resolve-border px-4 py-3 lg:px-6" : "px-4 py-5 lg:px-8"}>
      {!compact && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Mission
        </p>
      )}
      <form onSubmit={handleSubmit} className={compact ? "mt-0" : "mt-3"}>
        <div className="relative">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Communities confusing you? Fund Linux, indie music, research…"
            className="w-full rounded-full border border-resolve-border bg-resolve-bg-deep/50 px-5 py-3 pr-12 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-resolve-accent text-white transition hover:bg-blue-500 disabled:opacity-40"
            aria-label="Run mission"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
      {!compact && contextual.length > 0 && (
        <div className="mt-3">
          <MissionQuickActions actions={contextual} onSelect={(a) => onSubmit(a.prompt)} disabled={loading} variant="compact" />
        </div>
      )}
      {!compact && (
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="mt-2 text-[11px] text-resolve-accent hover:underline"
        >
          {showMore ? "Hide suggestions" : "Show all community actions"}
        </button>
      )}
    </div>
  );
}
