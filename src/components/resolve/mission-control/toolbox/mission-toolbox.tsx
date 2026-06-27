"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import {
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  Code2,
  Eye,
  FolderKanban,
  Library,
  PanelLeft,
  ScrollText,
  Vault,
  Workflow,
  Zap,
} from "lucide-react";
import type {
  ToolboxSectionId,
  ToolboxSnapshot,
} from "@/lib/mission/toolbox/types";
import { CommunityDnaPanel } from "@/components/resolve/mission-control/toolbox/community-dna";
import {
  loadMissionLibrary,
  removeMissionLibraryEntry,
} from "@/lib/mission/toolbox/mission-library";

const SECTIONS: { id: ToolboxSectionId; label: string; icon: typeof Library }[] = [
  { id: "library", label: "Mission Library", icon: Library },
  { id: "projects", label: "Projects", icon: FolderKanban },
  { id: "observatories", label: "Observatories", icon: Eye },
  { id: "policies", label: "Policies", icon: ScrollText },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "automations", label: "Automations", icon: Workflow },
  { id: "vaults", label: "Vaults", icon: Vault },
  { id: "knowledge", label: "Knowledge", icon: BookOpen },
  { id: "developers", label: "Developers", icon: Code2 },
];

export function MissionToolbox({
  onQuery,
  libraryVersion = 0,
}: {
  onQuery: (text: string) => void;
  libraryVersion?: number;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [section, setSection] = useState<ToolboxSectionId>("library");
  const [snapshot, setSnapshot] = useState<ToolboxSnapshot | null>(null);
  const [library, setLibrary] = useState(loadMissionLibrary());
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/mission/toolbox")
      .then((r) => r.json())
      .then((d) => setSnapshot(d as ToolboxSnapshot))
      .catch(() => setSnapshot(null));
  }, []);

  useEffect(() => {
    setLibrary(loadMissionLibrary());
  }, [libraryVersion]);

  const selectedProject = snapshot?.projects.find((p) => p.id === selectedProjectId);

  if (collapsed) {
    return (
      <aside className="flex w-11 shrink-0 flex-col items-center border-r border-resolve-border/50 bg-resolve-bg-deep/30 py-3">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded-lg p-2 text-resolve-muted transition hover:bg-resolve-hover/40 hover:text-white"
          aria-label="Open toolbox"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              title={s.label}
              onClick={() => {
                setCollapsed(false);
                setSection(s.id);
              }}
              className={clsx(
                "mt-2 rounded-lg p-2 transition",
                section === s.id ?
                  "bg-resolve-accent/15 text-resolve-accent"
                : "text-resolve-muted hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <aside className="flex w-[272px] shrink-0 flex-col border-r border-resolve-border/50 bg-resolve-bg-deep/30">
      <div className="flex items-center justify-between border-b border-resolve-border/40 px-3 py-2.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-accent">
            Toolbox
          </p>
          <p className="text-[11px] text-resolve-muted">Capital infrastructure</p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded-md p-1 text-resolve-muted transition hover:text-white"
          aria-label="Collapse toolbox"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex gap-0.5 overflow-x-auto border-b border-resolve-border/40 px-2 py-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              title={s.label}
              onClick={() => {
                setSection(s.id);
                setSelectedProjectId(null);
              }}
              className={clsx(
                "shrink-0 rounded-md p-1.5 transition",
                section === s.id ?
                  "bg-resolve-accent/15 text-resolve-accent"
                : "text-resolve-muted hover:bg-resolve-hover/30 hover:text-white",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!snapshot && (
          <p className="text-xs text-resolve-muted">Loading infrastructure…</p>
        )}

        {snapshot && section === "library" && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
              Long-running missions
            </p>
            {library.length === 0 && (
              <p className="text-xs text-resolve-muted">
                Missions you run are saved here for replay and comparison.
              </p>
            )}
            {library.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-resolve-border/50 p-2.5"
              >
                <button
                  type="button"
                  onClick={() => onQuery(entry.query)}
                  className="w-full text-left"
                >
                  <p className="text-xs font-medium text-white">{entry.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-resolve-muted">
                    {entry.query}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeMissionLibraryEntry(entry.id);
                    setLibrary(loadMissionLibrary());
                  }}
                  className="mt-1 text-[10px] text-resolve-muted-dim hover:text-rose-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {snapshot && section === "projects" && !selectedProject && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
              Living organizations
            </p>
            {snapshot.projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedProjectId(p.id)}
                className="w-full rounded-lg border border-resolve-border/50 p-2.5 text-left transition hover:border-resolve-accent/30"
              >
                <p className="text-xs font-medium text-white">{p.name}</p>
                <p className="mt-0.5 line-clamp-1 text-[10px] text-resolve-muted">{p.tagline}</p>
                <p className="mt-2 text-[10px] text-resolve-muted-dim">
                  Watching {p.watching.repos} repos · {p.watching.maintainers} maintainers · Risk{" "}
                  <span className="text-white/80">{p.status.risk}</span>
                </p>
              </button>
            ))}
          </div>
        )}

        {snapshot && section === "projects" && selectedProject && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSelectedProjectId(null)}
              className="flex items-center gap-1 text-[10px] text-resolve-muted hover:text-white"
            >
              <ChevronRight className="h-3 w-3 rotate-180" />
              All projects
            </button>
            <div className="rounded-lg border border-resolve-accent/20 bg-resolve-accent/5 p-3">
              <p className="text-sm font-medium text-white">{selectedProject.name}</p>
              <p className="mt-1 text-[11px] text-resolve-muted">{selectedProject.tagline}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <dt className="text-resolve-muted-dim">Risk</dt>
                  <dd className="text-white">{selectedProject.status.risk}</dd>
                </div>
                <div>
                  <dt className="text-resolve-muted-dim">Funding</dt>
                  <dd className="text-white">{selectedProject.status.funding}</dd>
                </div>
                <div>
                  <dt className="text-resolve-muted-dim">Growth</dt>
                  <dd className="text-white">{selectedProject.status.growth}</dd>
                </div>
                <div>
                  <dt className="text-resolve-muted-dim">Pools</dt>
                  <dd className="text-white">{selectedProject.watching.fundingPools}</dd>
                </div>
              </dl>
            </div>
            <CommunityDnaPanel dna={selectedProject.dna} name={selectedProject.name} />
            <button
              type="button"
              onClick={() =>
                onQuery(`Analyze ${selectedProject.repoFullName ?? selectedProject.name} ecosystem`)
              }
              className="w-full rounded-lg border border-resolve-border py-2 text-xs text-resolve-muted transition hover:border-resolve-accent/40 hover:text-white"
            >
              Open in Mission
            </button>
          </div>
        )}

        {snapshot && section === "observatories" && (
          <div className="space-y-3">
            {snapshot.observatories.map((obs) => (
              <div key={obs.id} className="rounded-lg border border-resolve-border/50 p-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-white">{obs.name}</p>
                  <span className="text-[10px] text-resolve-muted">{obs.watching} signals</span>
                </div>
                <p className="mt-1 text-[10px] text-resolve-muted-dim">
                  {obs.domains.join(" · ")}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {obs.pulses.map((pulse) => (
                    <li key={pulse.id}>
                      <button
                        type="button"
                        onClick={() => onQuery(`Explain: ${pulse.text}`)}
                        className="w-full rounded-md border border-resolve-border/40 px-2 py-1.5 text-left text-[10px] text-resolve-muted transition hover:border-resolve-accent/30 hover:text-white"
                      >
                        <span
                          className={clsx(
                            "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                            pulse.severity === "critical" ? "bg-rose-400"
                            : pulse.severity === "watch" ? "bg-amber-400"
                            : "bg-emerald-400",
                          )}
                        />
                        {pulse.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {snapshot && section === "policies" && (
          <div className="space-y-2">
            <p className="text-[10px] text-resolve-muted">
              Funding philosophy — AI reasons through these like Cursor Rules.
            </p>
            {snapshot.policies.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onQuery(`Apply ${p.name} policy to current mission`)}
                className="w-full rounded-lg border border-resolve-border/50 p-2.5 text-left transition hover:border-resolve-accent/30"
              >
                <p className="text-xs font-medium text-white">
                  {p.emoji} {p.name}
                  {p.active && (
                    <span className="ml-2 text-[10px] text-emerald-300">active</span>
                  )}
                </p>
                <p className="mt-1 text-[10px] text-resolve-muted">{p.description}</p>
              </button>
            ))}
          </div>
        )}

        {snapshot && section === "agents" && (
          <div className="space-y-2">
            {snapshot.agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-lg border border-resolve-border/50 p-2.5"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-white">{agent.name}</p>
                  <span
                    className={clsx(
                      "text-[10px] font-medium",
                      agent.status === "active" ? "text-emerald-300"
                      : agent.status === "alert" ? "text-rose-300"
                      : "text-resolve-muted",
                    )}
                  >
                    {agent.metric}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-resolve-muted">{agent.scope}</p>
                <p className="mt-1 text-[10px] text-resolve-muted-dim">{agent.detail}</p>
              </div>
            ))}
          </div>
        )}

        {snapshot && section === "automations" && (
          <div className="space-y-2">
            {snapshot.automations.map((rule) => (
              <div
                key={rule.id}
                className="rounded-lg border border-resolve-border/50 p-2.5"
              >
                <div className="flex items-center gap-2">
                  <Zap
                    className={clsx(
                      "h-3 w-3",
                      rule.enabled ? "text-amber-300" : "text-resolve-muted-dim",
                    )}
                  />
                  <p className="text-[10px] font-medium text-white">{rule.trigger}</p>
                </div>
                <p className="mt-1.5 pl-5 text-[10px] text-resolve-muted">↓ {rule.action}</p>
              </div>
            ))}
          </div>
        )}

        {snapshot && section === "vaults" && (
          <div className="space-y-2">
            {snapshot.vaults.map((v) => (
              <div key={v.id} className="rounded-lg border border-resolve-border/50 p-2.5">
                <p className="text-xs font-medium text-white">{v.name}</p>
                <p className="mt-0.5 text-[10px] text-resolve-muted">{v.purpose}</p>
                <p className="mt-2 text-sm font-medium tabular-nums text-white">
                  ${v.balanceUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                <p className="mt-1 text-[10px] text-resolve-muted-dim">
                  {v.owners} · {v.readiness}
                </p>
              </div>
            ))}
          </div>
        )}

        {snapshot && section === "knowledge" && (
          <div className="space-y-2">
            {snapshot.knowledge.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => onQuery(`Cite evidence: ${k.title}`)}
                className="w-full rounded-lg border border-resolve-border/50 p-2.5 text-left transition hover:border-resolve-accent/30"
              >
                <p className="text-xs text-white">{k.title}</p>
                <p className="mt-1 text-[10px] text-resolve-muted">
                  {k.kind} · {k.source}
                </p>
              </button>
            ))}
          </div>
        )}

        {snapshot && section === "developers" && (
          <div className="space-y-2">
            {snapshot.developers.map((d) => (
              <a
                key={d.id}
                href={d.href}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-resolve-border/50 p-2.5 transition hover:border-resolve-accent/30"
              >
                <p className="text-xs font-medium text-white">{d.label}</p>
                <p className="mt-0.5 text-[10px] text-resolve-muted">{d.description}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
