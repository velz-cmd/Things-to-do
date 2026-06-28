"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  Activity,
  ChevronLeft,
  Globe2,
  Library,
  PanelLeft,
  PenLine,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import {
  formatSessionTime,
  loadMissionSessions,
  removeMissionSession,
  sessionDisplayTitle,
  sessionSubtitle,
  type MissionSession,
} from "@/lib/mission/toolbox/mission-library";
import {
  getActiveEcosystemId,
  loadEcosystems,
  setActiveEcosystemId,
  type Ecosystem,
} from "@/lib/mission/ecosystems";
import {
  createServerEcosystem,
  deleteServerMission,
  fetchEcosystems,
  fetchMissions,
  fetchToolbox,
  serverEcosystemToClient,
  serverMissionToSession,
} from "@/lib/mission/client-api";
import type { AutomationRule, Observatory } from "@/lib/mission/toolbox/types";
import { statusLabel } from "@/lib/mission/state-machine";
import type { MissionStatus } from "@/lib/mission/state-machine";

/** Four permanent objects only: Library, Workspaces, Observatories, Automations. */
export function MissionSidebar({
  onNewMission,
  onSelectSession,
  onSelectWorkspace,
  onObservatoryPulse,
  onAutomationSelect,
  activeSessionId,
  activeWorkspaceId,
  libraryVersion = 0,
}: {
  onNewMission: () => void;
  onSelectSession: (session: MissionSession) => void;
  onSelectWorkspace: (workspace: Ecosystem | null) => void;
  onObservatoryPulse: (query: string) => void;
  onAutomationSelect: (rule: AutomationRule) => void;
  activeSessionId?: string | null;
  activeWorkspaceId?: string | null;
  libraryVersion?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<MissionSession[]>([]);
  const [workspaces, setWorkspaces] = useState<Ecosystem[]>([]);
  const [observatories, setObservatories] = useState<Observatory[]>([]);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [serverMode, setServerMode] = useState(false);
  const [addingWorkspace, setAddingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");

  const loadAll = useCallback(async () => {
    const [missions, eco, toolbox] = await Promise.all([
      fetchMissions(),
      fetchEcosystems(),
      fetchToolbox(),
    ]);

    if (toolbox) {
      setObservatories(toolbox.observatories ?? []);
      setAutomations(toolbox.automations ?? []);
    }

    if (missions !== null) {
      setServerMode(true);
      const ecoMap = new Map((eco ?? []).map((e) => [e.id, e.name]));
      setSessions(
        missions.map((m) =>
          serverMissionToSession(m, m.ecosystemId ? ecoMap.get(m.ecosystemId) : undefined),
        ),
      );
    } else {
      setServerMode(false);
      setSessions(loadMissionSessions());
    }

    if (eco) {
      setServerMode(true);
      setWorkspaces(eco.map(serverEcosystemToClient));
    } else if (missions === null) {
      setWorkspaces(loadEcosystems());
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [libraryVersion, loadAll]);

  useEffect(() => {
    const stored = getActiveEcosystemId();
    if (stored && !activeWorkspaceId && workspaces.length) {
      const ws = workspaces.find((e) => e.id === stored);
      if (ws) onSelectWorkspace(ws);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces.length]);

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-white/[0.06] bg-[#070b14]/90 py-4 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-lg p-2.5 text-resolve-muted transition hover:bg-white/[0.06] hover:text-white"
          aria-label="Expand sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  function handleSelectWorkspace(ws: Ecosystem) {
    const next = activeWorkspaceId === ws.id ? null : ws;
    setActiveEcosystemId(next?.id ?? null);
    onSelectWorkspace(next);
  }

  async function handleAddWorkspace(e: React.FormEvent) {
    e.preventDefault();
    const name = newWorkspaceName.trim();
    if (!name) return;

    if (serverMode) {
      const created = await createServerEcosystem(name);
      if (created) {
        setWorkspaces((prev) => [serverEcosystemToClient(created), ...prev]);
        setActiveEcosystemId(created.id);
        onSelectWorkspace(serverEcosystemToClient(created));
      }
    } else {
      const { addEcosystem } = await import("@/lib/mission/ecosystems");
      const created = addEcosystem(name);
      setWorkspaces(loadEcosystems());
      setActiveEcosystemId(created.id);
      onSelectWorkspace(created);
    }

    setNewWorkspaceName("");
    setAddingWorkspace(false);
  }

  async function handleDeleteSession(id: string) {
    if (serverMode) await deleteServerMission(id);
    else removeMissionSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/[0.06] bg-[#070b14]/95 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <p className="text-sm font-semibold text-white">Mission OS</p>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-md p-1.5 text-resolve-muted transition hover:bg-white/[0.06] hover:text-white"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-white/[0.06] px-3 py-3">
        <button
          type="button"
          onClick={onNewMission}
          className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm font-medium text-white transition hover:border-resolve-accent/30 hover:bg-white/[0.07]"
        >
          <PenLine className="h-4 w-4 text-resolve-accent" />
          New mission
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="px-3 py-3">
          <div className="flex items-center gap-2 px-2">
            <Library className="h-3.5 w-3.5 text-resolve-muted-dim" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              Mission library
            </p>
          </div>
          {sessions.length === 0 ?
            <p className="mt-3 px-2 text-xs leading-relaxed text-resolve-muted">
              Reusable mission history — one objective per workspace.
            </p>
          : <ul className="mt-2 space-y-0.5">
              {sessions.map((s) => (
                <li key={s.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectSession(s)}
                    className={clsx(
                      "min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left transition",
                      activeSessionId === s.id ?
                        "bg-resolve-accent/15 text-white"
                      : "text-resolve-muted hover:bg-white/[0.04] hover:text-white",
                    )}
                  >
                    <span className="block truncate text-[13px]">
                      {sessionDisplayTitle(s, workspaces)}
                    </span>
                    <span className="mt-0.5 flex gap-1.5 truncate text-[10px] text-resolve-muted-dim">
                      {formatSessionTime(s.updatedAt)}
                      {sessionSubtitle(s) && (
                        <span className="truncate">· {sessionSubtitle(s)}</span>
                      )}
                      {s.status && (
                        <span className="text-resolve-accent/80">
                          · {statusLabel(s.status as MissionStatus)}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteSession(s.id)}
                    className="rounded p-1 text-transparent transition group-hover:text-resolve-muted-dim hover:!text-rose-300"
                    aria-label="Delete mission"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          }
        </section>

        <div className="mx-3 border-t border-white/[0.06]" />

        <section className="px-3 py-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <Globe2 className="h-3.5 w-3.5 text-resolve-muted-dim" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                Communities
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddingWorkspace((v) => !v)}
              className="rounded p-1 text-resolve-muted-dim transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Add community"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 px-2 text-[10px] leading-relaxed text-resolve-muted-dim">
            Persistent community worlds — Linux, independent music, Pakistan OSS…
          </p>

          {addingWorkspace && (
            <form onSubmit={(e) => void handleAddWorkspace(e)} className="mt-2 px-2">
              <input
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Pakistan OSS"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none"
                autoFocus
              />
            </form>
          )}

          <ul className="mt-2 space-y-0.5">
            {workspaces.map((ws) => (
              <li key={ws.id}>
                <button
                  type="button"
                  onClick={() => handleSelectWorkspace(ws)}
                  className={clsx(
                    "w-full rounded-lg px-2.5 py-2 text-left transition",
                    activeWorkspaceId === ws.id ?
                      "bg-white/[0.06] text-white ring-1 ring-resolve-accent/25"
                    : "text-resolve-muted hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  <span className="block truncate text-[13px]">{ws.name}</span>
                  {ws.repos && ws.repos.length > 0 && (
                    <span className="mt-0.5 block truncate text-[10px] text-resolve-muted-dim">
                      {ws.repos.length} repos · {ws.connectors?.length ?? 0} sensors
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <div className="mx-3 border-t border-white/[0.06]" />

        <section className="px-3 py-3">
          <div className="flex items-center gap-2 px-2">
            <Activity className="h-3.5 w-3.5 text-resolve-muted-dim" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              Observatories
            </p>
          </div>
          <p className="mt-1 px-2 text-[10px] leading-relaxed text-resolve-muted-dim">
            Derived from GitHub opportunity scans — not separate live sensors.
          </p>
          <ul className="mt-2 space-y-1">
            {observatories.map((obs) => (
              <li key={obs.id} className="rounded-lg px-2 py-1.5">
                <p className="text-[12px] font-medium text-white/90">{obs.name}</p>
                {obs.pulses.slice(0, 2).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onObservatoryPulse(`Explain what changed: ${p.text}`)}
                    className="mt-1 block w-full truncate text-left text-[10px] text-resolve-muted transition hover:text-white"
                  >
                    <span
                      className={
                        p.severity === "critical" ? "text-rose-300/90" : "text-amber-200/80"
                      }
                    >
                      ●
                    </span>{" "}
                    {p.text}
                  </button>
                ))}
              </li>
            ))}
          </ul>
        </section>

        <div className="mx-3 border-t border-white/[0.06]" />

        <section className="px-3 py-3">
          <div className="flex items-center gap-2 px-2">
            <Zap className="h-3.5 w-3.5 text-resolve-muted-dim" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              Automations
            </p>
          </div>
          <ul className="mt-2 space-y-1">
            {automations.map((rule) => (
              <li key={rule.id}>
                <button
                  type="button"
                  onClick={() => onAutomationSelect(rule)}
                  className="w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.04]"
                >
                  <span className="block text-[11px] text-white/90">{rule.trigger}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-resolve-muted-dim">
                    → {rule.action}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}
