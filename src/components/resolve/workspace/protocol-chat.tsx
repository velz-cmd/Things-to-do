"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { Panel } from "@/components/resolve/ui/panel";
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
}: {
  onPoliciesChange?: (policies: PolicyProposal[]) => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [welcome, setWelcome] = useState<WelcomeData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [started, setStarted] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/workspace/ask")
      .then((r) => r.json())
      .then((d) => {
        setWelcome({
          greeting: d.greeting ?? "What would you like to do?",
          subtitle: d.subtitle ?? "",
          naturalLanguageActions: d.naturalLanguageActions ?? [],
          discoverPrompts: d.discoverPrompts ?? [],
        });
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

  return (
    <Panel variant="glow" className="flex h-full min-h-[480px] flex-col overflow-hidden p-0" padding={false}>
      <div className="border-b border-resolve-border/60 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg resolve-accent-gradient">
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-white">Chat</span>
            <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              Protocol
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!started && welcome && (
          <div className="space-y-3">
            <Panel variant="accent" className="p-4">
              <p className="text-base font-medium text-white">{welcome.greeting}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-resolve-muted">{welcome.subtitle}</p>
            </Panel>
            <div className="flex flex-wrap gap-1.5">
              {welcome.discoverPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void ask(p)}
                  className="rounded-full border border-resolve-border/60 bg-resolve-raised/50 px-3 py-1 text-[10px] text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={clsx(
              "rounded-resolve-lg px-4 py-3 text-sm leading-relaxed",
              m.role === "user"
                ? "ml-8 border border-resolve-border/40 bg-resolve-hover/80 text-white"
                : "mr-4 border border-resolve-accent/20 bg-resolve-accent/5 text-white/95",
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

      <div className="border-t border-resolve-border/60 bg-resolve-bg/40 p-4">
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
            placeholder="Ask about value, funding, or creators…"
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !input.trim()} size="md" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="mt-2 text-[10px] text-resolve-muted-dim">
          Evidence-backed · approval required ·{" "}
          <Link href="/payments" className="text-resolve-accent hover:underline">
            Treasury controls
          </Link>
        </p>
      </div>
    </Panel>
  );
}
