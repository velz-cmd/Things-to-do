"use client";

import { Sparkles, Loader2 } from "lucide-react";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";

export type IntelligenceMessage = {
  role: "user" | "resolve";
  text: string;
  concentrations?: ValueConcentration[];
  evidenceUsed?: string[];
};

export function IntelligenceWorkspace({
  messages,
  loading,
  idle,
}: {
  messages: IntelligenceMessage[];
  loading: boolean;
  idle: boolean;
}) {
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
        {idle && messages.length === 0 && (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
            <p className="max-w-md text-sm leading-relaxed text-resolve-muted">
              Mission Control reasons across live evidence — dependencies, maintainers, treasury,
              and settlements. State one objective to begin.
            </p>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-6">
          {messages.map((m, i) => (
            <article key={i}>
              {m.role === "user" ? (
                <p className="text-sm font-medium text-resolve-muted">{m.text}</p>
              ) : (
                <>
                  <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-resolve-accent">
                    <Sparkles className="h-3 w-3" />
                    Intelligence
                  </p>
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-white/95">
                    {m.text}
                  </p>
                  {m.concentrations && m.concentrations.length > 0 && (
                    <ul className="mt-4 space-y-2 border-l border-resolve-accent/20 pl-4">
                      {m.concentrations.map((c) => (
                        <li key={c.id} className="text-xs text-resolve-muted">
                          <span className="text-white/90">{c.title}</span> — {c.detail}
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.evidenceUsed && m.evidenceUsed.length > 0 && (
                    <p className="mt-3 text-[10px] text-resolve-muted-dim">
                      Evidence: {m.evidenceUsed.join(" · ")}
                    </p>
                  )}
                </>
              )}
            </article>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-resolve-muted">
              <Loader2 className="h-4 w-4 animate-spin text-resolve-accent" />
              Analyzing live evidence…
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
