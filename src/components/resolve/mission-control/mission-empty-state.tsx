"use client";

import { type FormEvent } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { MissionSignalRailsPanel } from "@/components/resolve/mission-control/mission-signal-rails-panel";
import { MissionAiProvidersPanel } from "@/components/resolve/mission-control/mission-ai-providers-panel";
import { PLATFORM_LOOP_TAGLINE } from "@/lib/economy/platform-loop";
import {
  RESOLVE_EXISTENTIAL_THESIS,
} from "@/lib/discover/resolve-doctrine";
import { formatAgentPrice } from "@/lib/agent/agent-signal-format";

const PRESETS = [
  {
    label: "Run intel on maintainers",
    prompt: "Run intel on React maintainers — docs gaps and contributor health",
    kind: "agent" as const,
  },
  {
    label: "User-centric royalties",
    prompt: "Create a user-centric royalty program for my Navidrome listeners — split monthly budget by real plays.",
    kind: "program" as const,
  },
  {
    label: "Fund maintainers",
    prompt: "Fund the top open-source maintainers in React based on real contribution signals.",
    kind: "program" as const,
  },
  {
    label: "Citation payout round",
    prompt: "Run a citation payout round for research authors — split by OpenAlex impact signals.",
    kind: "program" as const,
  },
];

const AGENT_EXAMPLES = [
  {
    label: "Docs review",
    prompt: "Run intel on React maintainers — docs gaps and contributor health",
    price: 0.02,
  },
  {
    label: "Sentiment",
    prompt: "Classify sentiment for maintainer feedback: love the DX but docs lag behind releases.",
    price: 0.001,
  },
  {
    label: "Security signal",
    prompt: "Extract CVEs from this advisory: critical RCE in libxml2 before 2.12.0.",
    price: 0.1,
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
          {RESOLVE_EXISTENTIAL_THESIS} Type a prompt — run intel, fund maintainers, or plan settlement.
        </p>
        <p className="mt-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-center text-xs font-medium leading-relaxed text-violet-100/95">
          {PLATFORM_LOOP_TAGLINE}
        </p>

        <form onSubmit={handleSubmit} className="mt-8">
          <div className="relative">
            <input
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="Run intel, describe a funding objective, or ask about risk…"
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
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Agent signals</p>
          <ul className="mt-3 space-y-2">
            {AGENT_EXAMPLES.map((ex) => (
              <li key={ex.label}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onSubmit(ex.prompt)}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-resolve-accent/25 hover:bg-resolve-accent/[0.04] disabled:opacity-40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white/90">
                      <Bot className="h-3.5 w-3.5 text-resolve-accent" />
                      {ex.label}
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-emerald-300">
                      {formatAgentPrice(ex.price)}
                    </span>
                  </div>
                  <span className="mt-0.5 block text-xs text-resolve-muted-dim">{ex.prompt}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Program templates</p>
          <ul className="mt-3 space-y-2">
            {PRESETS.filter((p) => p.kind === "program").map((ex) => (
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
          <MissionSignalRailsPanel onMissionPrompt={(prompt) => onSubmit(prompt)} />
        </div>
      </div>
    </div>
  );
}
