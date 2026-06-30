"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Bot, Sparkles } from "lucide-react";
import { AI_MODELS } from "@/lib/ai/gateway/models";

type AiConfig = {
  llmEnabled?: boolean;
  geminiEnabled?: boolean;
  groqEnabled?: boolean;
  openrouterEnabled?: boolean;
  ai?: {
    tiers?: Record<string, string[]>;
  };
};

const PROVIDERS = [
  {
    id: "gemini",
    name: "Google Gemini",
    env: "GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY",
    models: [AI_MODELS.gemini.quality, AI_MODELS.gemini.fast],
    use: "Mission chat quality + fast replies",
  },
  {
    id: "groq",
    name: "Groq · Llama",
    env: "GROQ_API_KEY",
    models: [AI_MODELS.groq.quality, AI_MODELS.groq.fast],
    use: "Low-latency Llama inference in Mission",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    env: "OPENROUTER_API_KEY",
    models: [AI_MODELS.openrouter.research, AI_MODELS.openrouter.code, AI_MODELS.openrouter.fast],
    use: "Research evidence, code worker, fallback models",
  },
] as const;

/** Mission — which LLM providers are live and how chat uses them. */
export function MissionAiProvidersPanel({ className }: { className?: string }) {
  const [config, setConfig] = useState<AiConfig | null>(null);

  useEffect(() => {
    void fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setConfig(data))
      .catch(() => setConfig(null));
  }, []);

  const enabled = {
    gemini: config?.geminiEnabled ?? false,
    groq: config?.groqEnabled ?? false,
    openrouter: config?.openrouterEnabled ?? false,
  };

  return (
    <section
      className={clsx(
        "rounded-2xl border border-white/[0.08] bg-[#0a0f18]/70 px-4 py-4 sm:px-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06]">
          <Sparkles className="h-4 w-4 text-resolve-calm-periwinkle" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-calm-periwinkle">
            Mission AI providers
          </p>
          <h2 className="mt-1 text-sm font-semibold text-white">Gemini, Llama, OpenRouter</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-resolve-muted">
            Mission chat picks the best configured model automatically — fast tier for replies,
            research tier for evidence. Add keys on Vercel to enable.
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {PROVIDERS.map((p) => {
          const live = enabled[p.id];
          return (
            <li
              key={p.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-white">{p.name}</p>
                <span
                  className={clsx(
                    "rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase",
                    live
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-white/15 bg-white/[0.04] text-resolve-muted",
                  )}
                >
                  {live ? "Live" : "Not configured"}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-resolve-muted-dim">{p.use}</p>
              <p className="mt-1 font-mono text-[9px] text-resolve-muted">
                {p.models.join(" · ")}
              </p>
              {!live && (
                <p className="mt-1 text-[9px] text-amber-200/80">Set {p.env} on Vercel</p>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 flex items-center gap-1.5 text-[10px] text-resolve-muted-dim">
        <Bot className="h-3 w-3" />
        Signal authorization rails below — pay-per-request on Arc, then continue in chat.
      </p>
    </section>
  );
}
