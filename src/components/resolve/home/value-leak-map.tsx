"use client";

import { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Code2,
  FileText,
  MessageCircle,
  Music2,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import styles from "./homepage.module.css";

type Leak = {
  id: string;
  label: string;
  icon: LucideIcon;
  observed: string;
  leak: string;
  mechanism: string;
  outcome: string;
  input: string;
  payout: string;
};

const LEAKS: Leak[] = [
  { id: "open-source", label: "Open source", icon: Code2, observed: "Dependencies, documentation, security work", leak: "Maintainers support products without a payout rule", mechanism: "Contribution evidence → program → maintainer allocation", outcome: "Evidence-backed maintainer funding", input: "Repository activity", payout: "Maintainer allocation" },
  { id: "music", label: "Music", icon: Music2, observed: "Verified listening and attribution", leak: "Platform pools hide the listener-to-artist path", mechanism: "User-centric play evidence → royalty program", outcome: "Listener-linked royalty policy", input: "Verified play", payout: "Royalty program" },
  { id: "research", label: "Research", icon: BookOpen, observed: "Citations and reused knowledge", leak: "Reuse is recognized but rarely paid", mechanism: "Citation evidence → author authorization", outcome: "Author-level capital authorization", input: "Citation record", payout: "Author authorization" },
  { id: "publishing", label: "Publishing", icon: FileText, observed: "Articles and source material reused by agents", leak: "Consumption creates value without compensation", mechanism: "Usage evidence → micropayment policy", outcome: "Usage-based compensation", input: "Usage evidence", payout: "Micropayment policy" },
  { id: "communities", label: "Communities", icon: MessageCircle, observed: "Moderation, support, governance, and operations", leak: "Essential community work has no funding mechanism", mechanism: "Verified contribution → policy-driven pool", outcome: "Fundable community obligations", input: "Contribution signal", payout: "Policy-driven pool" },
];

export function ValueLeakMap() {
  const [activeId, setActiveId] = useState(LEAKS[0].id);
  const active = LEAKS.find((item) => item.id === activeId) ?? LEAKS[0];

  return (
    <div className="mt-12 grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-2" role="tablist" aria-label="Value leak industries">
        {LEAKS.map((item) => {
          const Icon = item.icon;
          const selected = active.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveId(item.id)}
              onMouseEnter={() => setActiveId(item.id)}
              className={clsx(
                "group w-full rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
                selected ? "border-blue-400/30 bg-blue-400/[0.08]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14]",
              )}
            >
              <div className="flex items-center gap-3">
                <span className={clsx("grid h-9 w-9 place-items-center rounded-xl border", selected ? "border-blue-400/25 bg-blue-400/10 text-blue-300" : "border-white/[0.08] bg-black/15 text-resolve-muted")}>
                  <Icon className="h-4 w-4" strokeWidth={1.7} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">{item.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-resolve-muted">{item.observed}</span>
                </span>
                <ChevronDown className={clsx("h-4 w-4 text-resolve-muted transition md:-rotate-90", selected && "rotate-180 text-blue-300 md:rotate-0")} />
              </div>
              {selected && (
                <div className="mt-4 grid gap-3 border-t border-white/[0.07] pt-4 md:hidden">
                  <MobileDetail label="Current leak" value={item.leak} />
                  <MobileDetail label="RESOLVE mechanism" value={item.mechanism} />
                  <MobileDetail label="Potential outcome" value={item.outcome} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className={clsx(styles.leakVisual, "hidden p-6 md:block")} role="tabpanel">
        <div className="flex items-start justify-between gap-5 border-b border-white/[0.07] pb-5">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-300">Active route · {active.label}</p>
            <h3 className="mt-2 max-w-md text-xl font-semibold tracking-tight text-white">{active.outcome}</h3>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[9px] text-resolve-muted">Architecture view</span>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <Detail label="Observed work" value={active.observed} tone="blue" />
          <Detail label="Current leak" value={active.leak} tone="amber" />
        </div>

        <div className={clsx(styles.leakRoute, "mt-10")}>
          <RouteNode eyebrow="Input" value={active.input} />
          <span className={styles.leakLine} />
          <RouteNode eyebrow="RESOLVE" value="Evidence + policy" active />
          <span className={styles.leakLine} />
          <RouteNode eyebrow="Settlement" value={active.payout} success />
        </div>

        <div className="mt-9 rounded-xl border border-violet-400/15 bg-violet-400/[0.05] p-4">
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-violet-200">Mechanism</p>
          <p className="mt-2 text-sm text-white/85">{active.mechanism}</p>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value, tone }: { label: string; value: string; tone: "blue" | "amber" }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/15 p-4"><p className={clsx("text-[10px] font-semibold uppercase tracking-[0.12em]", tone === "amber" ? "text-amber-300/85" : "text-blue-300")}>{label}</p><p className="mt-2 text-xs leading-relaxed text-resolve-muted">{value}</p></div>;
}

function MobileDetail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] font-semibold uppercase tracking-wider text-blue-300">{label}</p><p className="mt-1 text-xs leading-relaxed text-resolve-muted">{value}</p></div>;
}

function RouteNode({ eyebrow, value, active, success }: { eyebrow: string; value: string; active?: boolean; success?: boolean }) {
  return <div className={clsx("rounded-xl border p-3 text-center", active ? "border-violet-400/30 bg-violet-400/[0.1]" : success ? "border-emerald-400/25 bg-emerald-400/[0.07]" : "border-blue-400/20 bg-blue-400/[0.06]")}><p className="text-[8px] uppercase tracking-wider text-resolve-muted-dim">{eyebrow}</p><p className="mt-1 text-[10px] font-semibold text-white">{value}</p></div>;
}
