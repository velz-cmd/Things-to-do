"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { Panel } from "@/components/resolve/ui/panel";

type Action = {
  id: string;
  label: string;
  detail: string;
  href: string;
  priority: string;
  evidence: string;
};

type AdvisorResult = {
  specialistLabel: string;
  answer: string;
  actions: Action[];
  grounded: boolean;
};

const STARTERS = [
  "What should I do next?",
  "We have treasury — who deserves funding?",
  "How do I distribute to 10k contributors?",
  "Where is value leaking in our ecosystem?",
];

export function WorkspaceAdvisor() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [result, setResult] = useState<AdvisorResult | null>(null);
  const [history, setHistory] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = useCallback(async (question: string) => {
    if (!question.trim()) return;
    setLoading(true);
    setHistory((h) => [...h, { role: "user", text: question }]);
    setInput("");

    try {
      const res = await fetch("/api/workspace/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Advisor unavailable");

      setResult({
        specialistLabel: data.specialistLabel,
        answer: data.answer,
        actions: data.actions ?? [],
        grounded: data.grounded,
      });
      setHistory((h) => [...h, { role: "assistant", text: data.answer }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not reach advisor";
      setHistory((h) => [...h, { role: "assistant", text: msg }]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch("/api/workspace/ask")
      .then((r) => r.json())
      .then((data) => {
        if (data.answer) {
          setResult({
            specialistLabel: data.specialistLabel,
            answer: data.answer,
            actions: data.actions ?? [],
            grounded: data.grounded,
          });
        }
      })
      .finally(() => setBootLoading(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, result]);

  return (
    <Panel className="overflow-hidden border-resolve-accent/25 bg-gradient-to-b from-resolve-accent/5 to-transparent">
      <div className="border-b border-resolve-border/60 px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-resolve-accent" />
          <h2 className="text-sm font-semibold text-white">Value Advisor</h2>
          {result?.specialistLabel && (
            <span className="rounded-full bg-resolve-accent/15 px-2 py-0.5 text-[10px] text-resolve-accent">
              {result.specialistLabel}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-resolve-muted">
          How can I help today? Every answer comes from live treasury, ledger, and connector data.
        </p>
      </div>

      <div className="max-h-72 space-y-3 overflow-y-auto px-5 py-4">
        {bootLoading && (
          <p className="text-sm text-resolve-muted">Analyzing your open ecosystems…</p>
        )}

        {history.map((m, i) => (
          <div
            key={i}
            className={clsx(
              "rounded-lg px-3 py-2 text-sm",
              m.role === "user"
                ? "ml-8 bg-resolve-hover text-white"
                : "mr-4 bg-resolve-raised/60 text-white/90",
            )}
          >
            {m.text}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-resolve-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reasoning from evidence…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {result?.actions && result.actions.length > 0 && (
        <ul className="space-y-1 border-t border-resolve-border/40 px-5 py-3">
          {result.actions.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Link
                href={a.href}
                className="block rounded-md px-2 py-1.5 text-xs hover:bg-resolve-hover/40"
              >
                <span className="font-medium text-white">{a.label}</span>
                <span className="mt-0.5 block text-resolve-muted">{a.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-resolve-border/60 p-4">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              disabled={loading}
              className="rounded-full border border-resolve-border/60 px-2.5 py-1 text-[10px] text-resolve-muted hover:border-resolve-accent/40 hover:text-white disabled:opacity-50"
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
            placeholder="We have $500k in treasury. What should we do?"
            className="min-w-0 flex-1 rounded-lg border border-resolve-border bg-resolve-bg px-3 py-2.5 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-resolve-accent px-3 py-2.5 text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </Panel>
  );
}
