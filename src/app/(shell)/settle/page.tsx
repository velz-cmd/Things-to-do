import Link from "next/link";
import { ArrowRight, Banknote, Layers, Shield } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { PAYMENT_LAYER_BLUEPRINT } from "@/lib/payment/blueprint";
import { AGENT_NANO_RATES } from "@/lib/payment/types";

const NANO_AGENTS = Object.entries(AGENT_NANO_RATES).map(([agent, amountUsd]) => ({
  agent,
  amountUsd,
}));

export default function SettlePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      <div className="space-y-3">
        <span className="inline-block rounded border border-emerald-500/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-400">
          Payment & Settlement Layer
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-white">Money flows through intelligence</h1>
        <p className="max-w-2xl text-sm text-resolve-muted">
          RESOLVE Payment Layer never rescans GitHub or recalculates weights. It only receives a verified{" "}
          <code className="text-xs text-white">MissionSettlement</code> package and executes capital safely via Arc
          escrow, Circle nanopayments, structured memos, and batch settlement.
        </p>
      </div>

      <Panel className="border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-emerald-400" />
          <p className="font-medium text-white">{PAYMENT_LAYER_BLUEPRINT.name}</p>
        </div>
        <p className="mt-1 text-xs text-resolve-muted">{PAYMENT_LAYER_BLUEPRINT.philosophy}</p>
        <div className="mt-4 space-y-1 font-mono text-sm text-resolve-muted">
          {PAYMENT_LAYER_BLUEPRINT.flow.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              {i > 0 && <span className="text-emerald-500/50">↓</span>}
              <span>{step}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel className="p-5">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-emerald-400" />
            <p className="text-sm font-medium text-white">Circle Nanopayments (Pipeline Agents)</p>
          </div>
          <p className="mt-1 text-xs text-resolve-muted">
            Each worker in the GitHub pipeline receives a micro-payout with Arc memo context.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {NANO_AGENTS.map((a) => (
              <li key={a.agent} className="flex justify-between border-b border-resolve-border/50 py-1">
                <span className="font-mono text-xs text-resolve-muted">{a.agent}</span>
                <span className="text-emerald-400">${a.amountUsd.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            <p className="text-sm font-medium text-white">Six Responsibilities</p>
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-sm text-resolve-muted">
            <li>Validate settlement package</li>
            <li>Lock treasury in Arc escrow</li>
            <li>Generate immutable settlement plan</li>
            <li>Batch settlement on Arc</li>
            <li>Attach structured Arc memos</li>
            <li>Emit auditable settlement events</li>
          </ol>
        </Panel>
      </div>

      <Panel className="p-5">
        <p className="text-sm font-medium text-white">Settlement States</p>
        <p className="mt-2 font-mono text-sm text-resolve-muted">
          {PAYMENT_LAYER_BLUEPRINT.states.join(" → ")}
        </p>
      </Panel>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/weight"
          className="inline-flex items-center gap-2 rounded-md bg-resolve-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Start from Weight Council
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/api/payment/blueprint"
          target="_blank"
          className="inline-flex items-center rounded-md border border-resolve-border px-4 py-2 text-sm text-white hover:border-resolve-accent/40"
        >
          Payment API Blueprint
        </Link>
        <Link
          href="/api/payment/history"
          target="_blank"
          className="inline-flex items-center rounded-md border border-resolve-border px-4 py-2 text-sm text-white hover:border-resolve-accent/40"
        >
          Settlement History
        </Link>
        <Link
          href="/docs/PAYMENT-LAYER.md"
          target="_blank"
          className="inline-flex items-center rounded-md border border-resolve-border px-4 py-2 text-sm text-white hover:border-resolve-accent/40"
        >
          Architecture Doc
        </Link>
      </div>
    </div>
  );
}
