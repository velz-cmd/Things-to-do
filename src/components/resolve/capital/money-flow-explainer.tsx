import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { CAPITAL_YIELD_COPY } from "@/lib/capital/copy";

const FLOW_STEPS = [
  { key: "value", label: "Value exists upstream", detail: "GitHub, Open Collective, Jellyfin — connectors observe" },
  { key: "authorize", label: "Authorization recorded", detail: "Economic fact at event time — not founder discretion" },
  { key: "fulfill", label: "Funder fulfills", detail: "Clear the queue or seed a QF match pool" },
  { key: "claim", label: "Creator claims", detail: "Settlement on Arc when capital exists" },
] as const;

export function MoneyFlowExplainer({ compact = false }: { compact?: boolean }) {
  const roles = CAPITAL_YIELD_COPY.roles;

  if (compact) {
    return (
      <BlueGlowCard variant="subtle" className="text-xs leading-relaxed text-resolve-muted">
        <p className="font-medium text-white">How money moves (bootstrap doctrine)</p>
        <p className="mt-1">
          Connectors authorize what is already owed → funders fulfill → creators claim.
          Founders operate programs; they do not invent value.{" "}
          <Link href="/capital?tab=programs" className="text-resolve-accent hover:underline">
            Fulfill obligations
          </Link>
        </p>
      </BlueGlowCard>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          How money moves
        </p>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-resolve-muted">
          {CAPITAL_YIELD_COPY.yieldExplainer.formula}. Treasury is not free platform money — every
          dollar came from a funder or operator deposit.
        </p>
      </div>

      <ol className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {FLOW_STEPS.map((step, i) => (
          <li key={step.key} className="flex items-center gap-2">
            <span className="rounded-lg border border-white/[0.08] bg-[#0a0f18]/60 px-3 py-2 text-[11px]">
              <span className="font-medium text-white">{step.label}</span>
              <span className="mt-0.5 block text-resolve-muted-dim">{step.detail}</span>
            </span>
            {i < FLOW_STEPS.length - 1 && (
              <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-resolve-muted-dim sm:block" />
            )}
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        {Object.values(roles).map((role) => (
          <div
            key={role.title}
            className="rounded-xl border border-white/[0.06] bg-[#0a0f18]/40 px-4 py-3"
          >
            <p className="text-xs font-medium text-white">{role.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-resolve-muted">{role.benefit}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
