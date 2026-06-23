"use client";

import Link from "next/link";
import type { Task } from "@/lib/deputy/ui-types";
import { MissionProgress } from "@/components/resolve/mission-progress";
import { HumanTimeline } from "@/components/resolve/human-timeline";
import { ConnectorReadinessPanel } from "@/components/resolve/connector-readiness-panel";
import { TechnicalAuditDrawer } from "@/components/resolve/technical-audit-drawer";
import { SettlementPanel } from "@/components/settlement/settlement-panel";
import { ResultCard } from "@/components/resolve/result-card";
import { buildHumanTimeline } from "@/lib/tasks/timeline-humanize";
import { taskStatusLabel } from "@/lib/resolve/progress";
import type { ConnectorStatus } from "@/lib/connectors/connector-types";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import { StatusChip } from "@/components/resolve/ui/status-chip";
import { ExecutionCostLedger } from "@/components/settlement/execution-cost-ledger";
import { AgentCredentialPanel } from "@/components/resolve/agent-credential-panel";
import { ArrowLeft } from "lucide-react";

export function MissionLiveScreen({
  task,
  connectors,
  nextAction,
  onAction,
  onUpdated,
  actionLoading,
}: {
  task: Task;
  connectors: ConnectorStatus[];
  nextAction: string;
  onAction: () => void;
  onUpdated: () => void;
  actionLoading?: boolean;
}) {
  const timeline = buildHumanTimeline(task.events ?? [], task.status);
  const isTerminal = ["settled", "failed", "refunded", "cancelled"].includes(task.status);
  const showResult = task.status === "settled";

  return (
    <div className="resolve-grid-bg mx-auto max-w-3xl space-y-4 px-4 py-8 lg:px-8">
      <Link
        href="/missions"
        className="inline-flex items-center gap-1.5 text-sm text-sky-400 hover:text-sky-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Missions
      </Link>

      <GlassPanel className="p-5" glow>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {task.isDemo && (
              <StatusChip label="Demo data" variant="demo" />
            )}
            <p className="mt-2 text-xs uppercase tracking-wide text-resolve-muted">Mission</p>
            <h1 className="mt-1 text-xl font-semibold leading-snug text-white">{task.title}</h1>
          </div>
          <StatusChip
            label={taskStatusLabel(task.status)}
            variant={
              task.status === "settled"
                ? "verified"
                : task.status === "needs_attention"
                  ? "running"
                  : task.status === "failed"
                    ? "blocked"
                    : "ready"
            }
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Expected value" value={`$${task.targetValueUsd.toFixed(2)}`} />
          <MiniStat label="Cost so far" value={`$${task.executionCostUsd.toFixed(3)}`} />
          <MiniStat
            label="Task budget"
            value={task.escrowLocked ? "Locked" : "Not locked"}
          />
          <MiniStat label="Proof" value={task.status === "proof_pending" || task.status === "verified" || task.status === "settled" ? "Submitted" : "Pending"} />
        </div>

        {task.attentionReason && (
          <p className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-100">
            {task.attentionReason}
          </p>
        )}
      </GlassPanel>

      {showResult ? (
        <ResultCard task={task} />
      ) : (
        <>
          <GlassPanel className="p-5">
            <MissionProgress status={task.status} label={taskStatusLabel(task.status)} />
          </GlassPanel>

          <ConnectorReadinessPanel connectors={connectors} category={task.category} compact />

          {!isTerminal && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={onAction}
              className="w-full rounded-xl bg-sky-500 py-3.5 text-sm font-semibold text-white shadow-[0_0_20px_-5px_rgba(56,189,248,0.4)] hover:bg-sky-400 disabled:opacity-50"
            >
              {actionLoading ? "Working…" : nextAction}
            </button>
          )}

          <HumanTimeline items={timeline} />

          <ExecutionCostLedger taskId={task.id} />

          <AgentCredentialPanel compact />

          <SettlementPanel
            taskId={task.id}
            budgetUsd={task.budgetUsd}
            onUpdated={onUpdated}
          />

          <TechnicalAuditDrawer
            events={task.events ?? []}
            microPayments={task.microPayments}
          />
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-resolve-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
