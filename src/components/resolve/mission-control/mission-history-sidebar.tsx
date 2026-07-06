"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronLeft, PenLine, Trash2 } from "lucide-react";
import {
  formatSessionTime,
  loadMissionSessions,
  removeMissionSession,
  type MissionSession,
} from "@/lib/mission/toolbox/mission-library";
import {
  deleteServerMission,
  fetchMissions,
  serverMissionToSession,
} from "@/lib/mission/client-api";
import { statusLabel } from "@/lib/mission/state-machine";
import type { MissionStatus } from "@/lib/mission/state-machine";
import { listMissionReports } from "@/lib/mission/mission-report-store";

/** Mission history only — revealed after the user starts a mission. */
export function MissionHistorySidebar({
  onNewMission,
  onSelectSession,
  activeSessionId,
  libraryVersion = 0,
}: {
  onNewMission: () => void;
  onSelectSession: (session: MissionSession) => void;
  activeSessionId?: string | null;
  libraryVersion?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<MissionSession[]>([]);
  const [serverMode, setServerMode] = useState(false);
  const [reportBadges, setReportBadges] = useState<
    Record<string, { status: string; reportId: string }>
  >({});

  const loadAll = useCallback(async () => {
    const reports = listMissionReports();
    const badges: Record<string, { status: string; reportId: string }> = {};
    for (const r of reports) {
      const key = r.objective.slice(0, 48).toLowerCase();
      badges[key] = { status: r.status, reportId: r.id };
    }
    setReportBadges(badges);

    const missions = await fetchMissions();
    if (missions !== null) {
      setServerMode(true);
      setSessions(missions.map((m) => serverMissionToSession(m)));
    } else {
      setServerMode(false);
      setSessions(loadMissionSessions());
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [libraryVersion, loadAll]);

  async function handleDeleteSession(id: string) {
    if (serverMode) await deleteServerMission(id);
    else removeMissionSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  if (collapsed) {
    return (
      <aside className="flex w-10 shrink-0 flex-col items-center border-r border-white/[0.06] bg-[#070b14]/90 py-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded p-2 text-resolve-muted hover:text-white"
          aria-label="Expand history"
        >
          <ChevronLeft className="h-4 w-4 rotate-180" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-white/[0.06] bg-[#070b14]/95">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-3">
        <p className="text-xs font-medium text-resolve-muted">History</p>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded p-1 text-resolve-muted hover:text-white"
          aria-label="Collapse"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="border-b border-white/[0.06] px-3 py-2">
        <button
          type="button"
          onClick={onNewMission}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-resolve-muted transition hover:bg-white/[0.04] hover:text-white"
        >
          <PenLine className="h-3.5 w-3.5" />
          New mission
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {sessions.length === 0 ?
          <p className="px-2 py-3 text-[11px] text-resolve-muted-dim">No prior missions</p>
        : <ul className="space-y-0.5">
            {sessions.map((s) => (
              <li key={s.id} className="group flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onSelectSession(s)}
                  className={clsx(
                    "min-w-0 flex-1 rounded-lg px-2 py-2 text-left transition",
                    activeSessionId === s.id ?
                      "bg-white/[0.06] text-white"
                    : "text-resolve-muted hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  <span className="block truncate text-[12px]">
                    {s.title || s.query || "Untitled"}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-resolve-muted-dim">
                    {formatSessionTime(s.updatedAt)}
                    {s.status && ` · ${statusLabel(s.status as MissionStatus)}`}
                    {(() => {
                      const badge =
                        reportBadges[(s.title || s.query || "").slice(0, 48).toLowerCase()];
                      if (!badge) return null;
                      const label =
                        badge.status === "authorized"
                          ? "Receipt"
                          : badge.status === "simulated"
                            ? "Blueprint"
                            : null;
                      return label ? ` · ${label}` : null;
                    })()}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteSession(s.id)}
                  className="rounded p-1 text-transparent group-hover:text-resolve-muted-dim hover:!text-rose-300"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        }
      </div>
    </aside>
  );
}
