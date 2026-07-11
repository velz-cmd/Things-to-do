"use client";

import { useState } from "react";
import { BookOpen, CircleDollarSign, Compass, Radio, Sparkles, UserRound, Users } from "lucide-react";
import clsx from "clsx";
import styles from "./homepage.module.css";

const TABS = [
  { id: "discover", label: "Discover", icon: Compass },
  { id: "mission", label: "Mission", icon: Sparkles },
  { id: "communities", label: "Communities", icon: Users },
  { id: "capital", label: "Capital", icon: CircleDollarSign },
  { id: "profile", label: "Profile", icon: UserRound },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PREVIEWS: Record<TabId, { title: string; eyebrow: string; fields: Array<[string, string]>; route: string[] }> = {
  discover: { title: "Verified work, made fundable", eyebrow: "Opportunity preview", fields: [["Evidence", "Repository activity"], ["Owed amount", "Calculated after analysis"], ["Program status", "Available to prepare"]], route: ["Opportunity", "Evidence", "Program"] },
  mission: { title: "Turn an objective into a Blueprint", eyebrow: "Mission preview", fields: [["Prompt", "Fund verified documentation"], ["Payee plan", "Evidence-linked contributors"], ["Authorization", "Operator approval required"]], route: ["Signal", "Blueprint", "Authorize"] },
  communities: { title: "Operate policy beside the community", eyebrow: "Community preview", fields: [["Treasury", "Wallet-linked"], ["Programs", "Policy-controlled"], ["Obligations", "Evidence queue"]], route: ["Community", "Program", "Obligation"] },
  capital: { title: "A treasury view grounded in receipts", eyebrow: "Capital preview", fields: [["Wallet", "Arc-compatible"], ["Settlement", "Pending approval"], ["Activity", "Receipt-backed"]], route: ["Authorize", "USDC", "Receipt"] },
  profile: { title: "One identity graph for attribution", eyebrow: "Profile preview", fields: [["Sources", "GitHub · music · research"], ["Payout wallet", "Account-bound"], ["Attribution", "Evidence-linked"]], route: ["Identity", "Evidence", "Wallet"] },
};

export function WorkspacePreview() {
  const [active, setActive] = useState<TabId>("discover");
  const preview = PREVIEWS[active];

  return (
    <div className={clsx(styles.workspaceFrame, "mt-12")}>
      <div className="relative flex min-h-12 items-center justify-between border-b border-white/[0.07] px-4 sm:px-5">
        <div className="flex gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400/60" /><span className="h-2.5 w-2.5 rounded-full bg-amber-300/60" /><span className="h-2.5 w-2.5 rounded-full bg-emerald-300/60" /></div>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-resolve-muted-dim">Product preview · read only</span>
        <Radio className="h-3.5 w-3.5 text-blue-300" />
      </div>

      <div className="relative grid lg:grid-cols-[180px_1fr]">
        <nav className="flex overflow-x-auto border-b border-white/[0.07] p-2 lg:flex-col lg:border-b-0 lg:border-r lg:p-3" aria-label="Product layer previews">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return <button key={tab.id} type="button" onClick={() => setActive(tab.id)} className={clsx("flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs transition", active === tab.id ? "bg-blue-400/[0.1] text-white ring-1 ring-blue-400/20" : "text-resolve-muted hover:bg-white/[0.04] hover:text-white")}><Icon className="h-3.5 w-3.5" />{tab.label}</button>;
          })}
        </nav>

        <div className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-white/[0.08] bg-[#09182b]/75 p-5 sm:p-6">
              <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-blue-300">{preview.eyebrow}</p>
              <h3 className="mt-3 max-w-lg text-2xl font-semibold tracking-tight text-white">{preview.title}</h3>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {preview.fields.map(([label, value]) => <div key={label} className="rounded-xl border border-white/[0.07] bg-black/15 p-3"><p className="text-[9px] uppercase tracking-wider text-resolve-muted-dim">{label}</p><p className="mt-2 text-[11px] font-medium leading-snug text-white">{value}</p></div>)}
              </div>
              <div className="mt-5 rounded-xl border border-violet-400/15 bg-violet-400/[0.05] p-4"><div className="flex items-center gap-2"><BookOpen className="h-3.5 w-3.5 text-violet-300" /><span className="text-[10px] font-semibold text-violet-100">Evidence context</span></div><p className="mt-2 text-[11px] leading-relaxed text-resolve-muted">The production workspace connects decisions to source evidence, identities, policies, and settlement state.</p></div>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-black/15 p-5">
              <div className="flex items-center justify-between"><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-resolve-muted">Operating path</p><span className="rounded-full border border-white/10 px-2 py-1 text-[8px] text-resolve-muted-dim">Example</span></div>
              <div className="mt-7 space-y-2">
                {preview.route.map((step, index) => <div key={step} className="relative flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-400/[0.09] font-mono text-[9px] text-blue-300">0{index + 1}</span><span className="text-[11px] font-medium text-white">{step}</span>{index < preview.route.length - 1 && <span className="absolute left-[26px] top-full h-2 w-px bg-blue-400/30" />}</div>)}
              </div>
              <div className="mt-5 rounded-xl border border-emerald-400/18 bg-emerald-400/[0.05] p-3"><p className="text-[9px] uppercase tracking-wider text-emerald-200">Outcome state</p><p className="mt-1 text-[11px] text-resolve-muted">No action is executed from this homepage preview.</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
