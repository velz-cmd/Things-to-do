"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  BookOpen,
  Bot,
  ChevronLeft,
  Code2,
  Eye,
  FolderKanban,
  Library,
  PanelLeft,
  PenLine,
  Plus,
  ScrollText,
  Sparkles,
  Trash2,
  Vault,
  Workflow,
  Zap,
} from "lucide-react";
import type { ToolboxSectionId, ToolboxSnapshot } from "@/lib/mission/toolbox/types";
import { CommunityDnaPanel } from "@/components/resolve/mission-control/toolbox/community-dna";
import {
  formatSessionTime,
  loadMissionSessions,
  removeMissionSession,
  type MissionSession,
} from "@/lib/mission/toolbox/mission-library";

const INFRA_SECTIONS: { id: ToolboxSectionId; label: string; hint: string; icon: typeof Library }[] = [
  { id: "library", label: "Mission Library", hint: "Saved intelligence runs", icon: Library },
  { id: "projects", label: "Projects", hint: "Living economic workspaces", icon: FolderKanban },
  { id: "observatories", label: "Observatories", hint: "Continuous ecosystem watch", icon: Eye },
  { id: "policies", label: "Policies", hint: "Funding philosophy", icon: ScrollText },
  { id: "agents", label: "Economic Agents", hint: "Background workers", icon: Bot },
  { id: "automations", label: "Automations", hint: "Event-driven capital flows", icon: Workflow },
  { id: "vaults", label: "Vaults", hint: "Programmable capital pools", icon: Vault },
  { id: "knowledge", label: "Knowledge", hint: "Ecosystem memory", icon: BookOpen },
  { id: "developers", label: "Developers", hint: "APIs & SDKs", icon: Code2 },
];

const AGENT_STARTER =
  "Deploy economic agents across my connected ecosystems — scan dependencies, treasury, and funding gaps.";

export function MissionToolbox({
  onQuery,
  onNewMission,
  onNewAgent,
  onSelectSession,
  activeSessionId,
  libraryVersion = 0,
}: {
  onQuery: (text: string) => void;
  onNewMission: () => void;
  onNewAgent: () => void;
  onSelectSession: (session: MissionSession) => void;
  activeSessionId?: string | null;
  libraryVersion?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [section, setSection] = useState<ToolboxSectionId | null>(null);
  const [snapshot, setSnapshot] = useState<ToolboxSnapshot | null>(null);
  const [sessions, setSessions] = useState<MissionSession[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/mission/toolbox")
      .then((r) => r.json())
      .then((d) => setSnapshot(d as ToolboxSnapshot))
      .catch(() => setSnapshot(null));
  }, []);

  useEffect(() => {
    setSessions(loadMissionSessions());
  }, [libraryVersion]);

  const selectedProject = snapshot?.projects.find((p) => p.id === selectedProjectId);
  const showInfraPanel = section !== null;

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
        <button
          type="button"
          onClick={onNewMission}
          title="New mission"
          className="mt-4 rounded-lg bg-resolve-accent/20 p-2.5 text-resolve-accent transition hover:bg-resolve-accent/30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-white/[0.06] bg-[#070b14]/95 backdrop-blur-xl">
      <div className="border-b border-white/[0.06] px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-resolve-accent/30 to-blue-600/20 ring-1 ring-resolve-accent/25">
              <Sparkles className="h-4 w-4 text-sky-200" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Mission</p>
              <p className="text-[10px] text-resolve-muted">Intelligence workspace</p>
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
            New agent
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-3 py-3">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            Recent
          </p>
          {sessions.length === 0 ? (
            <p className="mt-3 px-2 text-xs leading-relaxed text-resolve-muted">
              Your missions appear here. Start with a question — RESOLVE remembers it.
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

        <div className="mx-3 border-t border-white/[0.06]" />

        <div className="px-3 py-3">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            Infrastructure
          </p>
          <nav className="mt-2 space-y-0.5">
            {INFRA_SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSection(active ? null : s.id);
                    setSelectedProjectId(null);
                  }}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition",
                    active ?
                      "bg-white/[0.06] text-white ring-1 ring-resolve-accent/20"
                    : "text-resolve-muted hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  <Icon className={clsx("h-4 w-4 shrink-0", active && "text-resolve-accent")} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium leading-tight">{s.label}</p>
                    <p className="mt-0.5 truncate text-[10px] text-resolve-muted-dim">{s.hint}</p>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {showInfraPanel && snapshot && (
          <div className="border-t border-white/[0.06] bg-black/20 px-3 py-3">
            <InfraPanel
              section={section!}
              snapshot={snapshot}
              library={sessions}
              selectedProject={selectedProject}
              onQuery={onQuery}
              onSelectProject={setSelectedProjectId}
              onClearProject={() => setSelectedProjectId(null)}
              agentStarter={AGENT_STARTER}
            />
          </div>
        )}
      </div>
    </aside>
  );
}

function InfraPanel({
  section,
  snapshot,
  library,
  selectedProject,
  onQuery,
  onSelectProject,
  onClearProject,
  agentStarter,
}: {
  section: ToolboxSectionId;
  snapshot: ToolboxSnapshot;
  library: MissionSession[];
  selectedProject: ToolboxSnapshot["projects"][0] | undefined;
  onQuery: (text: string) => void;
  onSelectProject: (id: string) => void;
  onClearProject: () => void;
  agentStarter: string;
}) {
  if (section === "library") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-resolve-muted">
          {library.length} saved mission{library.length === 1 ? "" : "s"} in your library.
        </p>
        {library.slice(0, 5).map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => onQuery(e.query)}
            className="w-full rounded-lg border border-white/[0.06] p-2.5 text-left text-xs text-white transition hover:border-resolve-accent/30"
          >
            {e.title}
          </button>
        ))}
      </div>
    );
  }

  if (section === "projects" && !selectedProject) {
    return (
      <div className="space-y-2">
        {snapshot.projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectProject(p.id)}
            className="w-full rounded-lg border border-white/[0.06] p-2.5 text-left transition hover:border-resolve-accent/30"
          >
            <p className="text-xs font-medium text-white">{p.name}</p>
            <p className="mt-0.5 text-[10px] text-resolve-muted">{p.tagline}</p>
          </button>
        ))}
      </div>
    );
  }

  if (section === "projects" && selectedProject) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onClearProject} className="text-[10px] text-resolve-muted hover:text-white">
          ← All projects
        </button>
        <CommunityDnaPanel dna={selectedProject.dna} name={selectedProject.name} />
        <button
          type="button"
          onClick={() => onQuery(`Analyze ${selectedProject.repoFullName ?? selectedProject.name}`)}
          className="w-full rounded-lg border border-resolve-accent/30 py-2 text-xs text-sky-200 transition hover:bg-resolve-accent/10"
        >
          Open in mission
        </button>
      </div>
    );
  }

  if (section === "observatories") {
    return (
      <div className="space-y-2">
        {snapshot.observatories.map((obs) => (
          <div key={obs.id} className="rounded-lg border border-white/[0.06] p-2.5">
            <p className="text-xs font-medium text-white">{obs.name}</p>
            {obs.pulses.slice(0, 2).map((pulse) => (
              <button
                key={pulse.id}
                type="button"
                onClick={() => onQuery(`Explain: ${pulse.text}`)}
                className="mt-1.5 block w-full text-left text-[10px] text-resolve-muted hover:text-white"
              >
                • {pulse.text}
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (section === "agents") {
    return (
      <div className="space-y-2">
        {snapshot.agents.slice(0, 4).map((agent) => (
          <div key={agent.id} className="rounded-lg border border-white/[0.06] p-2.5">
            <p className="text-xs font-medium text-white">{agent.name}</p>
            <p className="text-[10px] text-emerald-300">{agent.metric}</p>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onQuery(agentStarter)}
          className="w-full rounded-lg bg-resolve-accent/10 py-2 text-xs text-sky-200 ring-1 ring-resolve-accent/20"
        >
          Run all agents
        </button>
      </div>
    );
  }

  if (section === "policies") {
    return (
      <div className="space-y-2">
        {snapshot.policies.slice(0, 4).map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onQuery(`Apply ${p.name} policy`)}
            className="w-full rounded-lg border border-white/[0.06] p-2.5 text-left text-xs text-white hover:border-resolve-accent/30"
          >
            {p.emoji} {p.name}
          </button>
        ))}
      </div>
    );
  }

  if (section === "automations") {
    return (
      <div className="space-y-2">
        {snapshot.automations.map((rule) => (
          <div key={rule.id} className="flex gap-2 text-[10px] text-resolve-muted">
            <Zap className={clsx("h-3 w-3 shrink-0", rule.enabled ? "text-amber-300" : "opacity-40")} />
            <span>{rule.trigger}</span>
          </div>
        ))}
      </div>
    );
  }

  if (section === "vaults") {
    return (
      <div className="space-y-2">
        {snapshot.vaults.map((v) => (
          <div key={v.id} className="rounded-lg border border-white/[0.06] p-2.5">
            <p className="text-xs text-white">{v.name}</p>
            <p className="text-sm font-medium tabular-nums text-white">
              ${v.balanceUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (section === "knowledge") {
    return (
      <div className="space-y-2">
        {snapshot.knowledge.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => onQuery(`Cite: ${k.title}`)}
            className="w-full text-left text-[10px] text-resolve-muted hover:text-white"
          >
            {k.title}
          </button>
        ))}
      </div>
    );
  }

  if (section === "developers") {
    return (
      <div className="space-y-2">
        {snapshot.developers.map((d) => (
          <a
            key={d.id}
            href={d.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-resolve-accent hover:underline"
          >
            {d.label}
          </a>
        ))}
      </div>
    );
  }

  return null;
}
