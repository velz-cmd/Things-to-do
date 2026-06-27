"use client";

import { useState, type FormEvent } from "react";
import { Send, Loader2 } from "lucide-react";

const EXAMPLES = [
  "Distribute $100k across React.",
  "Who deserves funding?",
  "Analyze navidrome/navidrome.",
  "Show underpaid maintainers.",
  "Find communities at risk.",
] as const;

export function MissionInput({
  value,
  onChange,
  onSubmit,
  loading,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (objective: string) => void;
  loading: boolean;
  compact?: boolean;
}) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || loading) return;
    onSubmit(value.trim());
  }

  return (
    <div className={compact ? "border-b border-resolve-border px-4 py-3 lg:px-6" : "px-4 py-5 lg:px-8"}>
      {!compact && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Mission Control
        </p>
      )}
      <form onSubmit={handleSubmit} className={compact ? "mt-0" : "mt-3"}>
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Distribute $100k across React · Who deserves funding? · Find value leaks…"
            className="min-w-0 flex-1 rounded-xl border border-resolve-border bg-resolve-bg-deep/50 px-4 py-3 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="flex shrink-0 items-center justify-center rounded-xl bg-resolve-accent px-4 text-white transition hover:bg-blue-500 disabled:opacity-40"
            aria-label="Run mission"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </form>
      {!compact && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => onSubmit(ex)}
              className="rounded-lg border border-resolve-border/60 px-2.5 py-1 text-[11px] text-resolve-muted transition hover:border-resolve-accent/30 hover:text-white"
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
