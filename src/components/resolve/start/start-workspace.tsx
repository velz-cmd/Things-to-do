"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import clsx from "clsx";
import Link from "next/link";
import type { Task } from "@/lib/deputy/ui-types";
import type { ConnectorStatus } from "@/lib/connectors/connector-types";
import type { TaskClassification } from "@/lib/tasks/classifier";
import {
  getMissingRequiredConnectors,
  nextActionLabel,
} from "@/lib/connectors/connector-service";
import { useAuth } from "@/components/auth/auth-provider";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { useCommand } from "@/components/resolve/command/command-context";
import { ConnectorReadinessPanel } from "@/components/resolve/connector-readiness-panel";
import { MissionProgress } from "@/components/resolve/mission-progress";
import { HumanTimeline } from "@/components/resolve/human-timeline";
import { SettlementPanel } from "@/components/settlement/settlement-panel";
import { ExecutionCostLedger } from "@/components/settlement/execution-cost-ledger";
import { TechnicalAuditDrawer } from "@/components/resolve/technical-audit-drawer";
import { ResultCard } from "@/components/resolve/result-card";
import { ProofUploadPanel, type EvidenceFileRow } from "@/components/resolve/start/proof-upload-panel";
import { Panel } from "@/components/resolve/ui/panel";
import { StatusChip, statusVariantForMission } from "@/components/resolve/ui/status-chip";
import { MissionStepper } from "@/components/resolve/missions/mission-stepper";
import { useMissionModal } from "@/components/resolve/missions/mission-modal-context";
import { EmptyState } from "@/components/resolve/ui/empty-state";
import { Money } from "@/components/resolve/ui/money";
import { LayoutList } from "lucide-react";
import { taskStatusLabel, taskProgress } from "@/lib/resolve/progress";
import { buildHumanTimeline } from "@/lib/tasks/timeline-humanize";
import { Mail, Wallet, ChevronRight } from "lucide-react";
import {
  fetchUserMemory,
  readSessionMemory,
  saveUserMemory,
  writeSessionMemory,
} from "@/lib/resolve/workspace-memory";

export function StartWorkspace() {
  return <MissionsWorkspace />;
}

export function MissionsWorkspace({ embedded }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready } = useResolveAccess();
  const { user } = useAuth();
  const { openSignIn } = useSignInModal();
  const { openModal } = useMissionModal();
  const {
    registerSubmitHandler,
    setSubmitLoading,
    setActiveTaskId,
    setDraft,
    pendingTask,
    clearPendingTask,
    hydrateMemory,
  } = useCommand();

  const prefilledTask =
    searchParams.get("task") ?? pendingTask ?? readSessionMemory().draft ?? "";
  const missionId =
    searchParams.get("mission") ??
    searchParams.get("id") ??
    readSessionMemory().activeMissionId ??
    null;
  const fromHome = searchParams.get("from") === "home";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [classification, setClassification] = useState<TaskClassification | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [evidence, setEvidence] = useState<EvidenceFileRow[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const memoryLoaded = useRef(false);

  const persistWorkspace = useCallback(
    (patch: {
      classification?: TaskClassification | null;
      showVault?: boolean;
      showMissions?: boolean;
      activeMissionId?: string | null;
      draft?: string;
    }) => {
      writeSessionMemory(patch);
      if (user) void saveUserMemory(patch);
    },
    [user]
  );

  const refresh = useCallback(async () => {
    const [t, c] = await Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/connectors/status").then((r) => r.json()),
    ]);
    setTasks(t.tasks ?? []);
    setConnectors(c.connectors ?? []);
  }, []);

  const loadEvidence = useCallback(async (taskId?: string | null) => {
    const q = taskId ? `?taskId=${taskId}` : "";
    const res = await fetch(`/api/evidence${q}`);
    if (!res.ok) return;
    const data = await res.json();
    setEvidence(data.files ?? []);
  }, []);

  const loadMission = useCallback(async (id: string) => {
    const res = await fetch(`/api/tasks/${id}`);
    const data = await res.json();
    setActiveTask(data.task ?? null);
    setActiveTaskId(id);
    await loadEvidence(id);
  }, [setActiveTaskId, loadEvidence]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (memoryLoaded.current) return;
    memoryLoaded.current = true;

    void (async () => {
      const session = readSessionMemory();
      if (session.showVault) setShowVault(true);
      if (session.showMissions) setShowMissions(true);
      if (session.classification) setClassification(session.classification);

      if (user) {
        const remote = await fetchUserMemory();
        if (remote.showVault) setShowVault(true);
        if (remote.showMissions) setShowMissions(true);
        if (remote.classification) setClassification(remote.classification);
        if (!missionId && remote.activeMissionId) {
          router.replace(`/missions?mission=${remote.activeMissionId}`);
        }
        if (remote.draft) {
          hydrateMemory({ draft: remote.draft });
        }
      } else if (!missionId && session.activeMissionId) {
        router.replace(`/missions?mission=${session.activeMissionId}`);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (missionId) {
      void loadMission(missionId);
      persistWorkspace({ activeMissionId: missionId });
    } else {
      setActiveTask(null);
      setActiveTaskId(null);
      void loadEvidence();
    }
  }, [missionId, loadMission, setActiveTaskId, loadEvidence, persistWorkspace]);

  useEffect(() => {
    persistWorkspace({ classification, showVault, showMissions });
  }, [classification, showVault, showMissions, persistWorkspace]);

  useEffect(() => {
    if (prefilledTask && !missionId && (fromHome || searchParams.get("from") === "radar")) {
      setDraft(prefilledTask);
      void handleAssign(prefilledTask);
      clearPendingTask();
    } else if (prefilledTask && !missionId) {
      setDraft(prefilledTask);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAssign = useCallback(
    async (input: string) => {
      if (!input.trim()) return;
      if (!ready) {
        openSignIn();
        return;
      }
      setSubmitLoading(true);
      try {
        const classifyRes = await fetch("/api/tasks/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        });
        const { classification: cls } = await classifyRes.json();
        setClassification(cls);
        persistWorkspace({ classification: cls, draft: input });

        if (cls.question && cls.missingInputs?.length > 0) {
          toast.message("Need more info", { description: cls.question });
          return;
        }

        const createRes = await fetch("/api/tasks/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input, classification: cls }),
        });
        const data = await createRes.json();
        if (!createRes.ok) throw new Error(data.error ?? "Could not create task");

        toast.success("Task started", {
          description: cls.isDemo ? "Demo — lock task budget when ready" : "Lock task budget to continue",
        });
        router.replace(`/missions?mission=${data.task.id}`);
        await loadMission(data.task.id);
        await refresh();
      } catch (e) {
        toast.error("Could not start", {
          description: e instanceof Error ? e.message : "Try again",
        });
      } finally {
        setSubmitLoading(false);
      }
    },
    [ready, openSignIn, setSubmitLoading, router, loadMission, refresh, persistWorkspace]
  );

  useEffect(() => {
    registerSubmitHandler(handleAssign);
    return () => registerSubmitHandler(null);
  }, [handleAssign, registerSubmitHandler]);

  async function handlePrimaryAction() {
    if (!activeTask || !ready) return;
    setActionLoading(true);
    const missing = getMissingRequiredConnectors(
      connectors,
      activeTask.category ?? "manual"
    );

    try {
      if (missing.some((m) => m.id === "gmail")) {
        window.location.href = "/api/connectors/gmail/authorize";
        return;
      }

      if (!activeTask.escrowLocked) {
        toast.message("Lock task budget", {
          description: "Use the payment panel to lock your task budget",
        });
        return;
      }

      const id = activeTask.id;
      if (["needs_attention", "escalated"].includes(activeTask.status)) {
        const res = await fetch(`/api/tasks/${id}/approve`, { method: "POST", body: "{}" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success("Approved");
      } else if (["waiting_for_response", "retrying"].includes(activeTask.status)) {
        const res = await fetch(`/api/tasks/${id}/retry`, { method: "POST" });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("Following up");
      } else {
        const res = await fetch(`/api/tasks/${id}/start`, { method: "POST" });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("Preparing claim");
      }
      await loadMission(id);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  const active = tasks.filter(
    (t) => !["settled", "failed", "refunded", "cancelled"].includes(t.status)
  );
  const pending = tasks.filter((t) =>
    ["needs_attention", "escalated", "proof_pending"].includes(t.status)
  );
  const isTerminal = activeTask
    ? ["settled", "failed", "refunded", "cancelled"].includes(activeTask.status)
    : false;
  const missing = activeTask
    ? getMissingRequiredConnectors(connectors, activeTask.category ?? "manual")
    : [];
  const nextAction = activeTask ? nextActionLabel(missing, activeTask) : "Start task";

  return (
    <div className={clsx(embedded ? "px-0 py-0" : "mx-auto max-w-6xl animate-resolve-enter px-6 py-6", fromHome && "")}>
      {activeTask ? (
        <div className="mb-6">
          <MissionStepper status={activeTask.status} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Task intake / active mission */}
          {activeTask ? (
            <ActiveMissionPanel
              task={activeTask}
              classification={classification}
              nextAction={nextAction}
              actionLoading={actionLoading}
              onAction={handlePrimaryAction}
              isTerminal={isTerminal}
            />
          ) : (
            <EmptyState
              icon={LayoutList}
              title="No mission selected"
              description="Create a bounty, distribution batch, or recovery mission. Outcomes settle on Arc only after verification."
              action={
                <button
                  type="button"
                  onClick={openModal}
                  className="rounded-md bg-resolve-accent px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  New mission
                </button>
              }
            />
          )}

          {/* Recent missions drawer toggle */}
          {active.length > 0 && (
            <Panel className="p-4">
              <button
                type="button"
                onClick={() => setShowMissions(!showMissions)}
                className="flex w-full items-center justify-between text-sm font-medium text-white"
              >
                Active tasks ({active.length})
                <ChevronRight
                  className={clsx("h-4 w-4 transition", showMissions && "rotate-90")}
                />
              </button>
              {showMissions && (
                <ul className="mt-3 space-y-2">
                  {tasks.slice(0, 8).map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/missions?mission=${t.id}`}
                        className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-sm hover:bg-black/30"
                      >
                        <span className="truncate text-white">{t.title}</span>
                        <span className="shrink-0 text-xs text-resolve-muted">
                          {taskStatusLabel(t.status)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {activeTask && !isTerminal && (
            <>
              <Panel className="p-5">
                <MissionProgress
                  status={activeTask.status}
                  label={taskStatusLabel(activeTask.status)}
                />
              </Panel>
              <HumanTimeline
                items={buildHumanTimeline(activeTask.events ?? [], activeTask.status)}
              />
              <ExecutionCostLedger taskId={activeTask.id} />
              <TechnicalAuditDrawer
                events={activeTask.events ?? []}
                microPayments={activeTask.microPayments}
              />
            </>
          )}

          {activeTask?.status === "settled" && <ResultCard task={activeTask} />}
        </div>

        {/* Escrow rail */}
        <div className="space-y-6 lg:col-span-1">
          <ConnectorReadinessPanel
            connectors={connectors}
            category={activeTask?.category ?? classification?.category}
            compact
          />

          <ProofUploadPanel
            taskId={activeTask?.id}
            files={evidence}
            onRefresh={() => void loadEvidence(activeTask?.id)}
          />

          {/* Approvals */}
          {pending.length > 0 && (
            <Panel className="space-y-3 p-5">
              <h2 className="text-sm font-semibold text-white">Needs approval</h2>
              {pending.map((t) => (
                <Link
                  key={t.id}
                  href={`/missions?mission=${t.id}`}
                  className="block rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm hover:bg-amber-500/10"
                >
                  <p className="font-medium text-white">{t.title}</p>
                  <p className="text-xs text-amber-100">{t.attentionReason ?? "Review required"}</p>
                </Link>
              ))}
            </Panel>
          )}

          {/* Vault drawer */}
          <Panel className="p-5">
            <button
              type="button"
              onClick={() => setShowVault(!showVault)}
              className="flex w-full items-center justify-between text-sm font-semibold text-white"
            >
              Connected accounts
              <ChevronRight
                className={clsx("h-4 w-4 transition", showVault && "rotate-90")}
              />
            </button>
            {showVault && (
              <div className="mt-4 space-y-3">
                <VaultAction icon={Mail} label="Gmail" action="Connect Gmail" href="/missions" />
                <VaultAction icon={Wallet} label="Wallet scan" action="Add in Radar" href="/radar" />
                <p className="text-[10px] text-resolve-muted">
                  RESOLVE never stores passwords, seed phrases, or private keys.
                </p>
              </div>
            )}
          </Panel>

          {activeTask && (
            <SettlementPanel
              taskId={activeTask.id}
              budgetUsd={activeTask.budgetUsd}
              onUpdated={() => void loadMission(activeTask.id)}
            />
          )}

          {activeTask?.proofs && activeTask.proofs.length > 0 && (
            <Panel className="p-5">
              <h2 className="text-sm font-semibold text-white">Verified proof</h2>
              <ul className="mt-3 space-y-2">
                {activeTask.proofs.map((p) => (
                  <li key={p.id} className="rounded-lg bg-black/20 px-3 py-2 text-xs">
                    <p className="font-medium text-white">{p.type.replace(/_/g, " ")}</p>
                    <p className="font-mono text-[10px] text-resolve-muted break-all">
                      {p.contentHash}
                    </p>
                    <StatusChip
                      label={p.verified ? "Verified" : "Pending"}
                      variant={p.verified ? "verified" : "running"}
                    />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function IntakeSummary({ classification }: { classification: TaskClassification }) {
  return (
    <div className="mt-4 space-y-2 rounded-md border border-resolve-border-strong bg-resolve-accent-muted p-4 text-sm">
      <p>
        <span className="text-resolve-muted">Detected: </span>
        <span className="text-white">{classification.category.replace(/_/g, " ")}</span>
      </p>
      {classification.company && (
        <p>
          <span className="text-resolve-muted">Company: </span>
          <span className="text-white">{classification.company}</span>
        </p>
      )}
      {classification.question && (
        <p className="text-amber-100">{classification.question}</p>
      )}
      {classification.isDemo && <StatusChip label="Demo data" variant="demo" />}
    </div>
  );
}

function ActiveMissionPanel({
  task,
  classification,
  nextAction,
  actionLoading,
  onAction,
  isTerminal,
}: {
  task: Task;
  classification: TaskClassification | null;
  nextAction: string;
  actionLoading: boolean;
  onAction: () => void;
  isTerminal: boolean;
}) {
  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {task.isDemo && <StatusChip label="Demo" variant="demo" />}
          <h2 className="mt-2 text-lg font-semibold text-white">{task.title}</h2>
          <p className="mt-2">
            <Money amount={task.targetValueUsd} size="sm" />
          </p>
        </div>
        <StatusChip
          label={taskStatusLabel(task.status)}
          variant={statusVariantForMission(task.status)}
        />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Stat label="Expected" value={`$${task.targetValueUsd.toFixed(2)}`} />
        <Stat label="Cost" value={`$${task.executionCostUsd.toFixed(3)}`} />
        <Stat label="Budget" value={task.escrowLocked ? "Locked" : "Not locked"} />
        <Stat label="Proof" value={task.proofHash ? "Submitted" : "Pending"} />
      </div>
      {task.attentionReason && (
        <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-100">
          {task.attentionReason}
        </p>
      )}
      {!isTerminal && (
        <button
          type="button"
          disabled={actionLoading}
          onClick={onAction}
          className="mt-4 w-full rounded-md bg-resolve-accent py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {actionLoading ? "Working…" : nextAction}
        </button>
      )}
      {classification && <IntakeSummary classification={classification} />}
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 px-2 py-1.5">
      <p className="text-[10px] uppercase text-resolve-muted">{label}</p>
      <p className="font-medium text-white">{value}</p>
    </div>
  );
}

function VaultAction({
  icon: Icon,
  label,
  action,
  href,
}: {
  icon: typeof Mail;
  label: string;
  action: string;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2">
      <span className="flex items-center gap-2 text-sm text-white">
        <Icon className="h-4 w-4 text-resolve-accent" />
        {label}
      </span>
      <Link href={href} className="text-xs text-resolve-accent hover:underline">
        {action}
      </Link>
    </div>
  );
}
