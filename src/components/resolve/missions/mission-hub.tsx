"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import clsx from "clsx";
import { ChevronDown, Landmark, ArrowRightLeft, Users, LayoutList } from "lucide-react";
import { GuidedIntakeChat } from "@/components/resolve/intake/guided-intake-chat";
import { MissionsWorkspace } from "@/components/resolve/missions/missions-workspace";
import { TreasuryPanel } from "@/components/resolve/missions/treasury-panel";
import { DistributePanel } from "@/components/resolve/missions/distribute-panel";
import { RegistryPanel } from "@/components/resolve/missions/registry-panel";
import { Panel } from "@/components/resolve/ui/panel";

type InfraPanel = "treasury" | "distribute" | "registry" | null;

const INFRA_SECTIONS = [
  { id: "treasury" as const, label: "Treasury", icon: Landmark },
  { id: "distribute" as const, label: "Weight & settle", icon: ArrowRightLeft },
  { id: "registry" as const, label: "Registry", icon: Users },
];

export function MissionHub() {
  const searchParams = useSearchParams();
  const missionId = searchParams.get("mission") ?? searchParams.get("id");
  const panelParam = searchParams.get("panel") as InfraPanel | "mission" | null;

  const [showIntake, setShowIntake] = useState(!missionId);
  const [openPanel, setOpenPanel] = useState<InfraPanel>(null);

  useEffect(() => {
    if (
      panelParam === "treasury" ||
      panelParam === "distribute" ||
      panelParam === "registry"
    ) {
      setOpenPanel(panelParam);
    }
  }, [panelParam]);

  const togglePanel = (id: InfraPanel) => {
    setOpenPanel((prev) => (prev === id ? null : id));
  };

  return (
    <div className="mx-auto max-w-7xl animate-resolve-enter px-4 py-4 lg:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
            Mission control
          </p>
          <h1 className="text-lg font-semibold text-white">Everything in one place</h1>
          <p className="mt-0.5 text-xs text-resolve-muted">
            Guided setup, active missions, treasury, payouts, and registry — transparent and compact.
          </p>
        </div>
        {!missionId && (
          <button
            type="button"
            onClick={() => setShowIntake((v) => !v)}
            className="text-xs text-resolve-accent hover:underline"
          >
            {showIntake ? "Hide guided setup" : "Show guided setup"}
          </button>
        )}
      </div>

      {showIntake && !missionId && (
        <div className="mb-4">
          <GuidedIntakeChat
            compact
            onComplete={() => setShowIntake(false)}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <Panel className="mb-4 flex items-center gap-2 border-resolve-border bg-resolve-raised/50 px-3 py-2">
            <LayoutList className="h-4 w-4 text-resolve-accent" />
            <span className="text-xs font-medium text-white">Active mission</span>
          </Panel>
          <MissionsWorkspace embedded />
        </div>

        <aside className="space-y-2 lg:sticky lg:top-4 lg:self-start">
          <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
            Infrastructure
          </p>
          {INFRA_SECTIONS.map(({ id, label, icon: Icon }) => (
            <div key={id} className="overflow-hidden rounded-lg border border-resolve-border bg-resolve-bg">
              <button
                type="button"
                onClick={() => togglePanel(id)}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-medium text-white hover:bg-resolve-hover/60"
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-resolve-accent" />
                  {label}
                </span>
                <ChevronDown
                  className={clsx(
                    "h-3.5 w-3.5 text-resolve-muted transition",
                    openPanel === id && "rotate-180",
                  )}
                />
              </button>
              {openPanel === id && (
                <div className="border-t border-resolve-border bg-black/20">
                  {id === "treasury" && <TreasuryPanel embedded />}
                  {id === "distribute" && <DistributePanel embedded />}
                  {id === "registry" && <RegistryPanel embedded />}
                </div>
              )}
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
