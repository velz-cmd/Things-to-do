"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { Panel } from "@/components/resolve/ui/panel";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";

type Action = {
  id: string;
  label: string;
  detail: string;
  href: string;
};

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
    <Panel className="flex h-full min-h-[420px] flex-col overflow-hidden border-resolve-border/80 bg-resolve-raised/30">
      <div className="border-b border-resolve-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-resolve-accent" />
          <span className="text-sm font-semibold text-white">Chat</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            Protocol
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!started && welcome && (
          <div className="space-y-3">
            <div className="rounded-xl border border-resolve-accent/20 bg-resolve-accent/5 p-4">
              <p className="text-base font-medium text-white">{welcome.greeting}</p>
              <p className="mt-1 text-xs leading-relaxed text-resolve-muted">{welcome.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {welcome.discoverPrompts.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void ask(p)}
                  className="rounded-full border border-resolve-border/50 px-2.5 py-1 text-[10px] text-resolve-muted hover:border-resolve-accent/50 hover:text-white"
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
              "rounded-xl px-3 py-2.5 text-sm leading-relaxed",
              m.role === "user"
                ? "ml-6 bg-resolve-hover text-white"
                : "mr-2 border border-resolve-border/40 bg-resolve-bg/80 text-white/90",
            )}
          >
            {m.role === "protocol" && (
              <p className="mb-1 flex items-center gap-1 text-[10px] font-medium text-resolve-accent">
                <Sparkles className="h-3 w-3" />
                Resolve
              </p>
            )}
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.concentrations && m.concentrations.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-resolve-border/30 pt-2 text-xs text-resolve-muted">
                {m.concentrations.map((c) => (
                  <li key={c.id}>
                    <span className="text-white/80">{c.title}</span> — {c.detail}
                  </li>
                ))}
              </ul>
            )}
            {m.policies && m.policies.length > 0 && (
              <p className="mt-2 text-[10px] text-amber-200/90">
                Policy options available below — nothing executes until you approve.
              </p>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-resolve-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analyzing live evidence…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-resolve-border/60 p-3">
        <p className="mb-2 text-[10px] uppercase tracking-wide text-resolve-muted-dim">
          Natural language actions
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(welcome?.naturalLanguageActions ?? []).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              disabled={loading}
              className="rounded-full border border-resolve-accent/30 bg-resolve-accent/5 px-2.5 py-1 text-[10px] text-sky-200 hover:bg-resolve-accent/15 disabled:opacity-50"
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
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about value, funding, or creators…"
            className="min-w-0 flex-1 rounded-lg border border-resolve-border bg-resolve-bg px-3 py-2.5 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-resolve-accent px-3 py-2.5 text-white hover:bg-blue-500 disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mt-2 text-[10px] text-resolve-muted-dim">
          Real APIs · real attribution · real settlement.{" "}
          <Link href="/payments" className="text-resolve-accent hover:underline">
            Manual controls →
          </Link>
        </p>
      </div>
    </Panel>
  );
}
