"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { Input } from "@/components/resolve/ui/input";
import { Button } from "@/components/resolve/ui/button";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";

type ChatMessage = {
  role: "user" | "protocol";
  text: string;
  concentrations?: ValueConcentration[];
  policies?: PolicyProposal[];
};

type WelcomeData = {
  greeting: string;
  subtitle: string;
  naturalLanguageActions: string[];
  discoverPrompts: string[];
};

export function ProtocolChat({
  onPoliciesChange,
  initialConcentrations,
  variant = "default",
  fullHeight = false,
  missionLabel,
}: {
  onPoliciesChange?: (policies: PolicyProposal[]) => void;
  initialConcentrations?: ValueConcentration[];
  variant?: "default" | "engine";
  fullHeight?: boolean;
  missionLabel?: string;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [welcome, setWelcome] = useState<WelcomeData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [started, setStarted] = useState(false);
  const [concentrations, setConcentrations] = useState<ValueConcentration[]>(
    initialConcentrations ?? [],
  );
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/workspace/ask")
      .then((r) => r.json())
      .then((d) => {
        setWelcome({
          greeting: d.greeting ?? "Open ecosystems are active.",
          subtitle: d.subtitle ?? "",
          naturalLanguageActions: d.naturalLanguageActions ?? [],
          discoverPrompts: d.discoverPrompts ?? [],
        });
        if (d.concentrations) setConcentrations(d.concentrations);
        if (d.policies) onPoliciesChange?.(d.policies);
      });
  }, [onPoliciesChange]);

  const ask = useCallback(
    async (question: string) => {
      if (!question.trim()) return;
      setStarted(true);
      setLoading(true);
      setMessages((m) => [...m, { role: "user", text: question }]);
      setInput("");

      try {
        const res = await fetch("/api/workspace/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Protocol unavailable");

        setMessages((m) => [
          ...m,
          {
            role: "protocol",
            text: data.answer,
            concentrations: data.concentrations,
            policies: data.policies,
          },
        ]);
        if (data.policies) onPoliciesChange?.(data.policies);
      } catch (e) {
        setMessages((m) => [
          ...m,
          {
            role: "protocol",
            text: e instanceof Error ? e.message : "Could not reach protocol layer.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [onPoliciesChange],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const isEngine = variant === "engine";

  return (
    <div
      className={clsx(
        "flex flex-col overflow-hidden rounded-2xl border border-resolve-border bg-resolve-bg-deep/40",
        fullHeight ? "h-full min-h-0" : "min-h-[480px]",
      )}
    >
      <div className="shrink-0 border-b border-resolve-border px-5 py-3">
        <div className="flex items-center gap-3">
          {!isEngine && (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl resolve-accent-gradient shadow-resolve-glow">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
          )}
          <div>
            <span className="text-sm font-semibold text-white">
              {missionLabel ? missionLabel : isEngine ? "Mission" : "Chat"}
            </span>
            {!isEngine && (
              <span className="ml-2 rounded-full bg-resolve-accent/15 px-2.5 py-0.5 text-[10px] font-semibold text-blue-200 ring-1 ring-resolve-accent/25">
                Protocol
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!started && welcome && (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-medium text-white">{welcome.greeting}</p>
              <p className="mt-2 text-sm leading-relaxed text-resolve-muted">{welcome.subtitle}</p>
            </div>
            {!isEngine && concentrations.length > 0 && (
              <ul className="space-y-2">
                {concentrations.slice(0, 3).map((c) => (
                  <li key={c.id} className="text-xs text-resolve-muted">
                    <span className="text-white/90">{c.title}</span> — {c.detail}
                  </li>
                ))}
              </ul>
            )}
            {isEngine ? (
              <div className="flex flex-wrap gap-2">
                {welcome.naturalLanguageActions.slice(0, 5).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => void ask(p)}
                    className="rounded-lg border border-resolve-border px-3 py-1.5 text-xs text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white"
                  >
                    {p}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {welcome.discoverPrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => void ask(p)}
                    className="rounded-full border border-resolve-border/60 px-3 py-1 text-[10px] text-resolve-muted transition hover:text-white"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={clsx(
              "rounded-resolve-lg px-4 py-3 text-sm leading-relaxed",
              m.role === "user"
                ? "ml-8 border border-resolve-border bg-resolve-accent/10 text-white"
                : "mr-4 border border-resolve-accent/20 bg-gradient-to-br from-resolve-accent/10 to-transparent text-white/95",
            )}
          >
            {m.role === "protocol" && (
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-resolve-accent">
                <Sparkles className="h-3 w-3" />
                Resolve
              </p>
            )}
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.concentrations && m.concentrations.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-resolve-border/30 pt-2 text-xs text-resolve-muted">
                {m.concentrations.map((c) => (
                  <li key={c.id}>
                    <span className="text-white/90">{c.title}</span> — {c.detail}
                  </li>
                ))}
              </ul>
            )}
            {m.policies && m.policies.length > 0 && (
              <p className="mt-2 text-[10px] text-amber-200/90">
                Policy options below — nothing executes until you approve.
              </p>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 px-1 text-xs text-resolve-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-resolve-accent" />
            Analyzing live evidence…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-resolve-border p-4">
        {!isEngine && (
          <>
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-resolve-muted-dim">
              Quick actions
            </p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(welcome?.naturalLanguageActions ?? []).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  disabled={loading}
                  className="rounded-full border border-resolve-accent/25 bg-resolve-accent/10 px-3 py-1 text-[10px] text-sky-200 transition hover:bg-resolve-accent/20 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              missionLabel
                ? `Ask anything about ${missionLabel}…`
                : isEngine
                  ? "I need $10k distributed to vercel/next.js contributors — analyze, authorize, settle in USDC"
                  : "Where is value leaking? Who should we fund?"
            }
            className="flex-1"
            inputSize={isEngine ? "lg" : "md"}
          />
          <Button type="submit" disabled={loading || !input.trim()} size="md" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        {isEngine && (
          <p className="mt-2 text-[10px] text-resolve-muted-dim">
            <Link href="/mission" className="text-resolve-accent hover:underline">
              Fund a repository
            </Link>
            {" · "}
            <Link href="/mission?panel=policies" className="text-resolve-accent hover:underline">
              Policies
            </Link>
            {" · "}
            <Link href="/capital" className="text-resolve-accent hover:underline">
              Capital
            </Link>
          </p>
        )}
        {!isEngine && (
          <p className="mt-2 text-[10px] text-resolve-muted-dim">
            Evidence-backed · approval required ·{" "}
            <Link href="/payments" className="text-resolve-accent hover:underline">
              Treasury
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
