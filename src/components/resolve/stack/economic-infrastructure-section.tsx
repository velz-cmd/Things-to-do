import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Coins,
  Cpu,
  RefreshCw,
  Shield,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { ENTRY_DOORS } from "@/lib/economy/entry-modes";
import { PROFIT_ENGINES } from "@/lib/economy/engines";
import { ECONOMIC_THESIS } from "@/lib/economy/manifest";

const DOOR_ICONS = {
  earn: Wallet,
  fund: Coins,
  operate: Users,
  protect: Shield,
  grow: Sparkles,
  build: Cpu,
  settle: RefreshCw,
} as const;

function EngineCard({
  name,
  tagline,
  shipped,
}: {
  name: string;
  tagline: string;
  shipped: boolean;
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-white">{name}</p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${
            shipped
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border border-white/10 bg-white/5 text-resolve-muted-dim"
          }`}
        >
          {shipped ? "Live" : "Next"}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-resolve-muted">{tagline}</p>
    </Panel>
  );
}

export function EconomicInfrastructureSection() {
  return (
    <section id="economic-infrastructure">
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-white">Economic infrastructure</h2>
          <span className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-300">
            Codex + Arc
          </span>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-resolve-muted">{ECONOMIC_THESIS}</p>
      </div>

      <Panel className="mb-4 border-violet-500/20 bg-violet-500/5 p-4">
        <div className="flex items-start gap-3">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
          <div>
            <p className="text-xs font-medium text-violet-200">Programmable economy layer</p>
            <p className="mt-1 text-sm text-resolve-muted">
              Seven entry doors. Six profit engines. Five capital modes. Not charity — embedded
              infrastructure where earners, funders, operators, companies, and developers all
              participate in the same settlement network on Arc.
            </p>
            <Link
              href="/api/economy/infrastructure"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200"
            >
              Infrastructure manifest
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </Panel>

      <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-resolve-muted-dim">
        Six profit engines
      </p>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROFIT_ENGINES.map((engine) => (
          <EngineCard
            key={engine.id}
            name={engine.name}
            tagline={engine.tagline}
            shipped={engine.shipped}
          />
        ))}
      </div>

      <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-resolve-muted-dim">
        Seven entry doors
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ENTRY_DOORS.map((door) => {
          const Icon = DOOR_ICONS[door.id] ?? Wallet;
          return (
            <Link
              key={door.id}
              href={door.primaryCta.href}
              className="group rounded-xl border border-resolve-border bg-resolve-raised p-3 transition hover:border-sky-500/30 hover:bg-sky-500/5"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-sky-300" />
                <span className="text-xs font-medium text-white">{door.label}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-resolve-muted group-hover:text-resolve-muted">
                {door.headline}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
