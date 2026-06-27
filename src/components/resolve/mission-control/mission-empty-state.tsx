"use client";

import { type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";

const EXAMPLES = [
  "I want to fund React.",
  "Find communities losing contributors.",
  "Who deserves funding?",
  "Show hidden infrastructure.",
  "Build a grant program.",
  "Help Pakistani OSS.",
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
          What would you like to accomplish?
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
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Examples</p>
          <ul className="mt-3 space-y-2">
            {EXAMPLES.map((ex) => (
              <li key={ex}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => onSubmit(ex)}
                  className="text-left text-sm text-resolve-muted transition hover:text-white disabled:opacity-40"
                >
                  {ex}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
