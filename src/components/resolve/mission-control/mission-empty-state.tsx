"use client";

import { type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { MissionSignalRailsPanel } from "@/components/resolve/mission-control/mission-signal-rails-panel";
import { MissionAiProvidersPanel } from "@/components/resolve/mission-control/mission-ai-providers-panel";

const PRESETS = [
  {
    label: "User-centric royalties",
    prompt: "Create a user-centric royalty program for my Navidrome listeners — split monthly budget by real plays.",
  },
  {
    label: "Fund maintainers",
    prompt: "Fund the top open-source maintainers in React based on real contribution signals.",
  },
  {
    label: "Citation payout round",
    prompt: "Run a citation payout round for research authors — split by OpenAlex impact signals.",
  },
  {
    label: "Split by activity",
    prompt: "Split my program budget across contributors by verified activity this month.",
  },
];

export function MissionEmptyState({
  input,
  onInputChange,
  onSubmit,
  loading,
}: {
  input: string;
  onInputChange: (v: string) => void;
  onSubmit: (text: string) => void;
  loading?: boolean;
}) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    onSubmit(input.trim());
  }

  return (
    <div className="flex min-h-[calc(100vh-3.75rem)] flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Mission</h1>
        <p className="mt-2 text-sm text-resolve-muted">
          Propose payout plans from real evidence — approve before anything settles.
        </p>

        <form onSubmit={handleSubmit} className="mt-8">
          <div className="relative">
            <input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Describe your funding objective…"
              disabled={loading}
              autoFocus
              className="w-full rounded-xl border border-white/[0.1] bg-[#0a0f18]/90 px-4 py-3.5 pr-12 text-sm text-white placeholder:text-resolve-muted-dim focus:border-white/20 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-black transition hover:bg-white/90 disabled:opacity-30"
              aria-label="Submit"
            >
              {loading ?
                <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />}
            </button>
          </div>
        </form>

        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Program templates</p>
          <ul className="mt-3 space-y-2">
            {PRESETS.map((ex) => (
              <li key={ex.label}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onSubmit(ex.prompt)}
                  className="text-left text-sm text-resolve-muted transition hover:text-white disabled:opacity-40"
                >
                  <span className="font-medium text-white/90">{ex.label}</span>
                  <span className="mt-0.5 block text-xs text-resolve-muted-dim">{ex.prompt}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 space-y-4">
          <MissionAiProvidersPanel />
          <MissionSignalRailsPanel onMissionPrompt={(prompt) => onInputChange(prompt)} />
        </div>
      </div>
    </div>
  );
}
