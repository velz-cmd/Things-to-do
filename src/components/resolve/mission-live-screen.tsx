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
import clsx from "clsx";

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
    <div className="mx-auto max-w-3xl space-y-4 p-4 lg:p-6">
      <Link href="/missions" className="text-sm text-blue-400 underline">
        ← Missions
      </Link>

      <header className="rounded-2xl border border-deputy-border bg-deputy-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {task.isDemo && (
              <span className="mb-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300">
                Demo data
              </span>
            )}
            <p className="text-xs uppercase text-deputy-muted">Task</p>
            <h1 className="text-lg font-semibold leading-snug">{task.title}</h1>
          </div>
          <StatusChip status={task.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Expected value" value={`$${task.targetValueUsd.toFixed(2)}`} />
          <MiniStat label="Cost so far" value={`$${task.executionCostUsd.toFixed(3)}`} />
          <MiniStat
            label="Arc escrow"
            value={task.escrowLocked ? "Locked" : "Awaiting lock"}
          />
          <MiniStat label="Status" value={taskStatusLabel(task.status)} />
        </div>

        {task.attentionReason && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {task.attentionReason}
          </p>
        )}
      </header>

      {showResult ? (
        <ResultCard task={task} />
      ) : (
        <>
          <section className="rounded-2xl border border-deputy-border bg-deputy-panel p-5">
            <MissionProgress status={task.status} label={taskStatusLabel(task.status)} />
          </section>

          <ConnectorReadinessPanel connectors={connectors} category={task.category} compact />

          {!isTerminal && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={onAction}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {actionLoading ? "Working…" : nextAction}
            </button>
          )}

          <HumanTimeline items={timeline} />

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
    <div>
      <p className="text-[10px] uppercase text-deputy-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const styles: Record<string, string> = {
    settled: "bg-emerald-500/15 text-emerald-300",
    failed: "bg-red-500/15 text-red-300",
    needs_attention: "bg-amber-500/15 text-amber-300",
    executing: "bg-amber-500/15 text-amber-300",
    waiting_for_response: "bg-zinc-500/15 text-zinc-300",
  };
  return (
    <span
      className={clsx(
        "rounded-full px-3 py-1 text-xs font-medium capitalize",
        styles[status] ?? "bg-blue-500/15 text-blue-300"
      )}
    >
      {taskStatusLabel(status)}
    </span>
  );
}
