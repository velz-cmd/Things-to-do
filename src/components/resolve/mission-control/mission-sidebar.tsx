"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  BookOpen,
  ChevronLeft,
  Globe2,
  Library,
  PanelLeft,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react";
import {
  formatSessionTime,
  loadMissionSessions,
  removeMissionSession,
  type MissionSession,
} from "@/lib/mission/toolbox/mission-library";
import {
  getActiveEcosystemId,
  loadEcosystems,
  setActiveEcosystemId,
  type Ecosystem,
} from "@/lib/mission/ecosystems";
import { loadKnowledge, type KnowledgeEntry } from "@/lib/mission/knowledge";
import {
  createServerEcosystem,
  deleteServerMission,
  fetchEcosystems,
  fetchKnowledge,
  fetchMissions,
  fetchTimeline,
  fetchWorkbench,
  serverEcosystemToClient,
  serverKnowledgeToClient,
  serverMissionToSession,
  type ServerTimelineEvent,
  type ServerWorkbench,
} from "@/lib/mission/client-api";
import { MissionTimeline } from "@/components/resolve/mission-control/mission-timeline";
import { MissionWorkbenchPanel } from "@/components/resolve/mission-control/mission-workbench-panel";
import { statusLabel } from "@/lib/mission/state-machine";
import type { MissionStatus } from "@/lib/mission/state-machine";

export function MissionSidebar({
  onNewMission,
  onSelectSession,
  onSelectEcosystem,
  onSelectKnowledge,
  activeSessionId,
  activeEcosystemId,
  libraryVersion = 0,
}: {
  onNewMission: () => void;
  onSelectSession: (session: MissionSession) => void;
  onSelectEcosystem: (ecosystem: Ecosystem | null) => void;
  onSelectKnowledge: (entry: KnowledgeEntry) => void;
  activeSessionId?: string | null;
  activeEcosystemId?: string | null;
  libraryVersion?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<MissionSession[]>([]);
  const [ecosystems, setEcosystems] = useState<Ecosystem[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [timeline, setTimeline] = useState<ServerTimelineEvent[]>([]);
  const [workbench, setWorkbench] = useState<ServerWorkbench | null>(null);
  const [serverMode, setServerMode] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [addingEcosystem, setAddingEcosystem] = useState(false);
  const [newEcosystemName, setNewEcosystemName] = useState("");
  const [workbenchOpen, setWorkbenchOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [missions, eco, know, wb] = await Promise.all([
        fetchMissions(),
        fetchEcosystems(),
        fetchKnowledge(),
        fetchWorkbench(),
      ]);

      if (missions !== null) {
        setServerMode(true);
        setSessions(missions.map(serverMissionToSession));
      } else {
        setServerMode(false);
        setSessions(loadMissionSessions());
        setEcosystems(loadEcosystems());
        setKnowledge(loadKnowledge());
        setWorkbench(null);
        setTimeline([]);
        return;
      }

      if (eco) setEcosystems(eco.map(serverEcosystemToClient));
      if (know) setKnowledge(know.map(serverKnowledgeToClient));
      setWorkbench(wb);

      const ecoId = activeEcosystemId ?? getActiveEcosystemId();
      if (ecoId) {
        const events = await fetchTimeline({ ecosystemId: ecoId });
        setTimeline(events ?? []);
      } else {
        setTimeline([]);
      }
    } finally {
      setLoadingData(false);
    }
  }, [activeEcosystemId]);

  useEffect(() => {
    void loadAll();
  }, [libraryVersion, loadAll]);

  useEffect(() => {
    const stored = getActiveEcosystemId();
    if (stored && !activeEcosystemId && ecosystems.length) {
      const eco = ecosystems.find((e) => e.id === stored);
      if (eco) onSelectEcosystem(eco);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once on mount
  }, [ecosystems.length]);

  useEffect(() => {
    if (!serverMode || !activeEcosystemId) {
      if (!activeEcosystemId) setTimeline([]);
      return;
    }
    void fetchTimeline({ ecosystemId: activeEcosystemId }).then((events) => {
      setTimeline(events ?? []);
    });
  }, [activeEcosystemId, serverMode, libraryVersion]);

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

  function handleSelectEcosystem(eco: Ecosystem) {
    const next = activeEcosystemId === eco.id ? null : eco;
    setActiveEcosystemId(next?.id ?? null);
    onSelectEcosystem(next);
  }

  async function handleAddEcosystem(e: React.FormEvent) {
    e.preventDefault();
    const name = newEcosystemName.trim();
    if (!name) return;

    if (serverMode) {
      const created = await createServerEcosystem(name);
      if (created) {
        setEcosystems((prev) => [serverEcosystemToClient(created), ...prev]);
        setActiveEcosystemId(created.id);
        onSelectEcosystem(serverEcosystemToClient(created));
      }
    } else {
      const { addEcosystem } = await import("@/lib/mission/ecosystems");
      const created = addEcosystem(name);
      setEcosystems(loadEcosystems());
      setActiveEcosystemId(created.id);
      onSelectEcosystem(created);
    }

    setNewEcosystemName("");
    setAddingEcosystem(false);
  }

  async function handleDeleteSession(id: string) {
    if (serverMode) {
      await deleteServerMission(id);
    } else {
      removeMissionSession(id);
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  const activeEco = ecosystems.find((e) => e.id === activeEcosystemId);

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-white/[0.06] bg-[#070b14]/95 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <p className="text-sm font-semibold text-white">Mission</p>
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
            {serverMode && (
              <span className="ml-auto text-[9px] text-emerald-400/70">synced</span>
            )}
          </div>
          {sessions.length === 0 ?
            <p className="mt-3 px-2 text-xs leading-relaxed text-resolve-muted">
              Every conversation becomes a reusable mission.
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
                      {s.title || s.query || "Untitled mission"}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] text-resolve-muted-dim">
                      {formatSessionTime(s.updatedAt)}
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
                Ecosystems
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddingEcosystem((v) => !v)}
              className="rounded p-1 text-resolve-muted-dim transition hover:bg-white/[0.06] hover:text-white"
              aria-label="Add ecosystem"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {addingEcosystem && (
            <form onSubmit={(e) => void handleAddEcosystem(e)} className="mt-2 px-2">
              <input
                value={newEcosystemName}
                onChange={(e) => setNewEcosystemName(e.target.value)}
                placeholder="My DAO"
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none"
                autoFocus
              />
            </form>
          )}

          <ul className="mt-2 space-y-0.5">
            {ecosystems.map((eco) => (
              <li key={eco.id}>
                <button
                  type="button"
                  onClick={() => handleSelectEcosystem(eco)}
                  className={clsx(
                    "w-full rounded-lg px-2.5 py-2 text-left text-[13px] transition",
                    activeEcosystemId === eco.id ?
                      "bg-white/[0.06] text-white ring-1 ring-resolve-accent/20"
                    : "text-resolve-muted hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  <span className="block truncate">{eco.name}</span>
                  {eco.repos && eco.repos.length > 0 && (
                    <span className="mt-0.5 block truncate text-[10px] text-resolve-muted-dim">
                      {eco.repos.length} repos · {eco.connectors?.length ?? 0} sensors
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {activeEco && serverMode && (
            <div className="mt-3 px-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
                Timeline · {activeEco.name}
              </p>
              <MissionTimeline events={timeline} loading={loadingData} />
            </div>
          )}
        </section>

        <div className="mx-3 border-t border-white/[0.06]" />

        <section className="px-3 py-3">
          <div className="flex items-center gap-2 px-2">
            <BookOpen className="h-3.5 w-3.5 text-resolve-muted-dim" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              Knowledge
            </p>
          </div>
          {knowledge.length === 0 ?
            <p className="mt-3 px-2 text-xs leading-relaxed text-resolve-muted">
              RESOLVE remembers research, decisions, and reasoning from your missions.
            </p>
          : <ul className="mt-2 space-y-0.5">
              {knowledge.slice(0, 12).map((k) => (
                <li key={k.id}>
                  <button
                    type="button"
                    onClick={() => onSelectKnowledge(k)}
                    className="w-full rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.04]"
                  >
                    <span className="block truncate text-[13px] text-resolve-muted hover:text-white">
                      {k.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-resolve-muted-dim">
                      {k.summary}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          }
        </section>

        {serverMode && (
          <>
            <div className="mx-3 border-t border-white/[0.06]" />
            <MissionWorkbenchPanel
              workbench={workbench}
              loading={loadingData && !workbench}
              expanded={workbenchOpen}
              onToggle={() => setWorkbenchOpen((v) => !v)}
            />
          </>
        )}
      </div>
    </aside>
  );
}
