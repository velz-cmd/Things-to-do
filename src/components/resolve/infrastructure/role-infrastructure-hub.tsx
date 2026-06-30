"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import type { EcosystemRoleId } from "@/lib/capital/ecosystem-program";
import {
  buildRoleWorkbench,
  listProfessionalRoles,
} from "@/lib/economy/actor-routing";
import { PhaseRoadmapPanel } from "@/components/resolve/infrastructure/phase-roadmap-panel";
import { ValueFlowPanel } from "@/components/resolve/infrastructure/value-flow-panel";
import { CapitalModePicker } from "@/components/resolve/infrastructure/capital-mode-picker";
import { DaoGovernancePanel } from "@/components/resolve/infrastructure/dao-governance-panel";
import { RepaymentSimulatorPanel } from "@/components/resolve/infrastructure/repayment-simulator-panel";

type RoleTab = EcosystemRoleId | "dao";

const ROLE_TABS: { id: RoleTab; label: string }[] = [
  { id: "funder", label: "Funder" },
  { id: "founder", label: "Founder" },
  { id: "operator", label: "Operator" },
  { id: "dao", label: "DAO" },
  { id: "creator", label: "Creator" },
];

type Props = {
  variant?: "full" | "compact";
  defaultRole?: RoleTab;
  signedIn?: boolean;
};

export function RoleInfrastructureHub({
  variant = "full",
  defaultRole = "funder",
  signedIn = false,
}: Props) {
  const [activeRole, setActiveRole] = useState<RoleTab>(defaultRole);
  const workbench = buildRoleWorkbench(activeRole);

  return (
    <section className="space-y-8">
      <div className={variant === "compact" ? "space-y-2" : "space-y-3"}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          Economic infrastructure
        </p>
        <h2
          className={clsx(
            "font-semibold text-white",
            variant === "compact" ? "text-lg" : "text-2xl",
          )}
        >
          Professional infrastructure for every role
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-resolve-muted">
          Funders, founders, operators, and DAOs share one settlement network on Arc.
          Pick your role — each path has engines, workflows, and APIs built for production.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1">
        {ROLE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveRole(tab.id)}
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-medium transition",
              activeRole === tab.id
                ? "bg-white/[0.08] text-white"
                : "text-resolve-muted hover:text-white",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <BlueGlowCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
              {workbench.label} workbench
            </p>
            <h3 className="mt-1 text-xl font-semibold text-white">{workbench.headline}</h3>
            {workbench.entryDoor && (
              <p className="mt-2 text-sm text-resolve-muted">{workbench.entryDoor.description}</p>
            )}
          </div>
          {workbench.entryDoor && (
            <Link
              href={workbench.entryDoor.primaryCta.href}
              className="inline-flex items-center gap-1 rounded-resolve bg-resolve-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {workbench.entryDoor.primaryCta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
              Profit engines
            </p>
            <ul className="mt-2 space-y-2">
              {workbench.engines.map((engine) => (
                <li
                  key={engine.id}
                  className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2"
                >
                  <Check
                    className={clsx(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      engine.shipped ? "text-emerald-400" : "text-resolve-muted-dim",
                    )}
                  />
                  <div>
                    <p className="text-xs font-medium text-white">{engine.name}</p>
                    <p className="text-[11px] text-resolve-muted">{engine.tagline}</p>
                    <span
                      className={clsx(
                        "mt-1 inline-block text-[9px] uppercase",
                        engine.shipped ? "text-emerald-300" : "text-amber-300",
                      )}
                    >
                      {engine.shipped ? "Live" : "Next"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
              Your workflow
            </p>
            <ol className="mt-2 space-y-2">
              {workbench.workflows.map((w) => (
                <li key={w.step}>
                  <Link
                    href={w.href}
                    className="group flex gap-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 transition hover:border-resolve-accent/30"
                  >
                    <span className="font-mono text-xs text-resolve-accent">{w.step}</span>
                    <div>
                      <p className="text-xs font-medium text-white group-hover:text-resolve-accent">
                        {w.title}
                      </p>
                      <p className="text-[11px] text-resolve-muted">{w.detail}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {workbench.capitalModes.length > 0 && variant === "full" && (
          <div className="mt-6 border-t border-white/[0.06] pt-6">
            <CapitalModePicker modes={workbench.capitalModes} />
          </div>
        )}

        {activeRole === "dao" && variant === "full" && (
          <div className="mt-6 border-t border-white/[0.06] pt-6">
            <DaoGovernancePanel signedIn={signedIn} />
          </div>
        )}

        {(activeRole === "funder" || activeRole === "founder") && variant === "full" && (
          <div className="mt-6 border-t border-white/[0.06] pt-6">
            <RepaymentSimulatorPanel />
          </div>
        )}

        {variant === "full" && workbench.apiSurfaces.length > 0 && (
          <div className="mt-6 border-t border-white/[0.06] pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
              API surfaces
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {workbench.apiSurfaces.slice(0, 8).map((api) => (
                <li
                  key={api}
                  className="rounded border border-white/[0.06] px-2 py-1 font-mono text-[10px] text-resolve-muted"
                >
                  {api}
                </li>
              ))}
            </ul>
            <Link
              href="/api/economy/infrastructure"
              target="_blank"
              className="mt-3 inline-flex items-center gap-1 text-xs text-resolve-accent hover:underline"
            >
              Infrastructure manifest
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
      </BlueGlowCard>

      {variant === "full" && (
        <>
          <div className="grid gap-8 lg:grid-cols-2">
            <ValueFlowPanel />
            <PhaseRoadmapPanel filterGroup="codex" />
          </div>
          <PhaseRoadmapPanel filterGroup="advanced" />
        </>
      )}

      {variant === "compact" && (
        <p className="text-center text-xs text-resolve-muted">
          <Link href="/program" className="text-resolve-accent hover:underline">
            Full infrastructure roadmap →
          </Link>
        </p>
      )}
    </section>
  );
}

export { listProfessionalRoles };
