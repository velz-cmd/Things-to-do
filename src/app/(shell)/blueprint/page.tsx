"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, GitBranch, Layers, Shield, Workflow } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";

type Blueprint = {
  name: string;
  phase: string;
  thesis: string;
  pipeline: { layer: number; name: string; role: string; ai: boolean | string }[];
  workers: { id: string; name: string; output: string; rejects?: boolean; note?: string }[];
  trustTiers: { tier: string; meaning: string }[];
  apis: { required: { name: string; use: string }[]; postSettlement: { name: string; use: string }[] };
  runtime?: Record<string, boolean>;
};

export default function BlueprintPage() {
  const [bp, setBp] = useState<Blueprint | null>(null);

  useEffect(() => {
    void fetch("/api/github/blueprint")
      .then((r) => r.json())
      .then(setBp)
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <header>
        <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
          Operating system blueprint · GitHub v1
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-white">Capital Allocation OS</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-resolve-muted">
          {bp?.thesis ??
            "RESOLVE is an Evidence Operating System for capital allocation — not a collection of AI judges that vote against each other."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/radar"
            className="inline-flex items-center gap-1 rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Open Radar <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs/GITHUB-OS.md"
            className="inline-flex items-center gap-1 rounded-md border border-resolve-border px-4 py-2 text-sm text-white hover:bg-resolve-hover"
          >
            Full spec (markdown)
          </Link>
        </div>
      </header>

      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <Workflow className="h-5 w-5 text-resolve-accent" />
          <h2 className="text-lg font-semibold text-white">Pipeline (Cursor-style orchestration)</h2>
        </div>
        <p className="mt-2 text-xs text-resolve-muted">
          Workers publish to the Evidence Bus. Only the Reasoning Engine reads everything — once.
        </p>
        <ol className="mt-4 space-y-2">
          {(bp?.pipeline ?? []).map((step) => (
            <li
              key={step.layer}
              className="flex flex-wrap items-baseline gap-2 rounded border border-resolve-border bg-resolve-bg/40 px-3 py-2 text-sm"
            >
              <span className="font-mono text-[10px] text-resolve-muted">L{step.layer}</span>
              <span className="font-medium text-white">{step.name}</span>
              <span className="text-resolve-muted">— {step.role}</span>
              {step.ai && (
                <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] text-violet-200">
                  AI
                </span>
              )}
            </li>
          ))}
        </ol>
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Seven workers — one job each</h2>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {(bp?.workers ?? []).map((w) => (
            <li key={w.id} className="rounded border border-resolve-border p-3 text-xs">
              <p className="font-semibold text-white">{w.name}</p>
              <p className="mt-1 text-resolve-muted">→ {w.output}</p>
              {w.rejects === false && (
                <p className="mt-1 text-emerald-400">Never rejects — confidence only</p>
              )}
              {w.note && <p className="mt-1 text-amber-200/90">{w.note}</p>}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-white">Sybil resistance — confidence tiers</h2>
        </div>
        <p className="mt-2 text-xs text-resolve-muted">
          No commits/day rules. Cursor-assisted humans are not bots. New contributors get
          &quot;unknown&quot; — not rejected.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {(bp?.trustTiers ?? []).map((t) => (
            <li key={t.tier} className="flex gap-2">
              <span className="shrink-0 font-mono text-[10px] uppercase text-resolve-accent">
                {t.tier}
              </span>
              <span className="text-resolve-muted">{t.meaning}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-5">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-resolve-accent" />
          <h2 className="text-lg font-semibold text-white">API stack (lean)</h2>
        </div>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 text-xs">
          <div>
            <p className="font-medium text-white">Required</p>
            <ul className="mt-2 space-y-1 text-resolve-muted">
              {(bp?.apis.required ?? []).map((a) => (
                <li key={a.name}>
                  · {a.name} — {a.use}
                  {bp?.runtime &&
                    (a.name.includes("GitHub")
                      ? bp.runtime.githubToken
                        ? " ✓"
                        : " ✗"
                      : a.name.includes("OpenRouter")
                        ? bp.runtime.openRouter
                          ? " ✓"
                          : " ✗"
                        : "")}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-medium text-white">Post-settlement only</p>
            <ul className="mt-2 space-y-1 text-resolve-muted">
              {(bp?.apis.postSettlement ?? []).map((a) => (
                <li key={a.name}>· {a.name} — {a.use}</li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  );
}
