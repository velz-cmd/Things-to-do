"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  Bot,
  ChevronLeft,
  PanelLeft,
  PenLine,
  Radio,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ToolboxSnapshot } from "@/lib/mission/toolbox/types";
import {
  formatSessionTime,
  loadMissionSessions,
  removeMissionSession,
  sessionPhaseLabel,
  type MissionSession,
} from "@/lib/mission/toolbox/mission-library";

const AGENT_STARTER =
  "Deploy economic agents across my connected ecosystems — scan dependencies, treasury, and funding gaps.";

function agentStatusColor(status: ToolboxSnapshot["agents"][0]["status"]) {
  switch (status) {
    case "alert":
      return "text-rose-300";
    case "working":
      return "text-sky-200";
    case "watching":
      return "text-emerald-300";
    default:
      return "text-resolve-muted-dim";
  }
}

export function MissionOsPanel({
  onQuery,
  onNewMission,
  onNewAgent,
  onSelectSession,
  activeSessionId,
  activeScope,
  libraryVersion = 0,
}: {
  onQuery: (text: string) => void;
  onNewMission: () => void;
  onNewAgent: () => void;
  onSelectSession: (session: MissionSession) => void;
  activeSessionId?: string | null;
  activeScope?: string | null;
  libraryVersion?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [snapshot, setSnapshot] = useState<ToolboxSnapshot | null>(null);
  const [sessions, setSessions] = useState<MissionSession[]>([]);

  useEffect(() => {
    void fetch("/api/mission/toolbox")
      .then((r) => r.json())
      .then((d) => setSnapshot(d as ToolboxSnapshot))
      .catch(() => setSnapshot(null));
  }, [libraryVersion]);

  useEffect(() => {
    setSessions(loadMissionSessions());
  }, [libraryVersion]);

  if (collapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center border-r border-white/[0.06] bg-[#070b14]/90 py-4 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-lg p-2.5 text-resolve-muted transition hover:bg-white/[0.06] hover:text-white"
          aria-label="Expand mission panel"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  const activeAgents = snapshot?.agents.filter((a) => a.status !== "idle") ?? [];
  const alerts = snapshot?.alerts.filter((a) => a.severity !== "positive") ?? [];
  const activePolicies = snapshot?.policies.filter((p) => p.active) ?? [];

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-white/[0.06] bg-[#070b14]/95 backdrop-blur-xl">
      <div className="border-b border-white/[0.06] px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-resolve-accent/30 to-blue-600/20 ring-1 ring-resolve-accent/25">
              <Sparkles className="h-4 w-4 text-sky-200" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Mission Control</p>
              <p className="text-[10px] text-resolve-muted">Operating system</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded-md p-1.5 text-resolve-muted transition hover:bg-white/[0.06] hover:text-white"
            aria-label="Collapse panel"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={onNewMission}
            className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm font-medium text-white transition hover:border-resolve-accent/30 hover:bg-white/[0.07]"
          >
            <PenLine className="h-4 w-4 text-resolve-accent" />
            New mission
          </button>
          <button
            type="button"
            onClick={onNewAgent}
            className="flex w-full items-center gap-2.5 rounded-xl border border-transparent px-3.5 py-2 text-sm text-resolve-muted transition hover:border-white/[0.06] hover:bg-white/[0.03] hover:text-white"
          >
            <Bot className="h-4 w-4" />
            Deploy agents
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {activeScope && (
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              This mission
            </p>
            <p className="mt-1.5 text-[13px] leading-snug text-white/90">{activeScope}</p>
          </div>
        )}

        {activeAgents.length > 0 && (
          <div className="px-3 py-3">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              Active agents
            </p>
            <ul className="mt-2 space-y-2">
              {activeAgents.map((agent) => (
                <li key={agent.id}>
                  <button
                    type="button"
                    onClick={() => onQuery(agent.query)}
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-left transition hover:border-resolve-accent/25 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center gap-2">
                      <Bot className={clsx("h-3.5 w-3.5 shrink-0", agentStatusColor(agent.status))} />
                      <span className="text-[12px] font-medium text-white">{agent.name}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-resolve-muted">
                      {agent.currentTask}
                    </p>
                    <p className="mt-1 text-[10px] text-resolve-muted-dim">
                      {agent.confidence}% confidence · {agent.nextObservation}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="px-3 py-3">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              Watching
            </p>
            <ul className="mt-2 space-y-1.5">
              {alerts.slice(0, 4).map((alert) => (
                <li key={alert.id}>
                  <button
                    type="button"
                    onClick={() => onQuery(alert.query)}
                    className="flex w-full gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.04]"
                  >
                    <Radio
                      className={clsx(
                        "mt-0.5 h-3 w-3 shrink-0",
                        alert.severity === "critical" ? "text-rose-400" : "text-amber-300",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-[10px] text-resolve-muted-dim">{alert.observatoryName}</p>
                      <p className="text-[11px] leading-snug text-resolve-muted">{alert.text}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="px-3 py-3">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            Memory
          </p>
          {sessions.length === 0 ? (
            <p className="mt-3 px-2 text-xs leading-relaxed text-resolve-muted">
              Every mission remembers scope, reasoning, and decisions. Ask something — RESOLVE keeps
              it.
            </p>
          ) : (
            <ul className="mt-2 space-y-0.5">
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
                    <div className="flex items-center gap-2">
                      {s.kind === "agent" ?
                        <Bot className="h-3.5 w-3.5 shrink-0 opacity-70" />
                      : <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-70" />}
                      <span className="truncate text-[13px]">{s.title || s.query || "Untitled"}</span>
                    </div>
                    <p className="mt-0.5 truncate pl-5 text-[10px] text-resolve-muted-dim">
                      {formatSessionTime(s.updatedAt)}
                      {s.phase ? ` · ${sessionPhaseLabel(s.phase)}` : ""}
                      {s.findingCount ? ` · ${s.findingCount} findings` : ""}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeMissionSession(s.id);
                      setSessions(loadMissionSessions());
                    }}
                    className="rounded p-1 text-transparent transition group-hover:text-resolve-muted-dim hover:!text-rose-300"
                    aria-label="Delete mission"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {activePolicies.length > 0 && (
          <div className="border-t border-white/[0.06] px-3 py-3">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
              Influencing reasoning
            </p>
            <ul className="mt-2 space-y-1.5">
              {activePolicies.map((p) => (
                <li key={p.id} className="px-2.5 py-1">
                  <p className="text-[12px] text-white/90">
                    {p.emoji} {p.name}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-resolve-muted-dim">
                    {p.influences}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {!snapshot && (
          <p className="px-4 py-3 text-[11px] text-resolve-muted-dim">
            Agents and observatories activate when ecosystems are connected.
          </p>
        )}
      </div>
    </aside>
  );
}

export { AGENT_STARTER };
