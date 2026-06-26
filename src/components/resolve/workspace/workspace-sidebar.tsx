"use client";

import Link from "next/link";
import clsx from "clsx";
import { Plus, Radio } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";

export type RecentWorkspace = {
  id: string;
  label: string;
  type: "github" | "navidrome" | "other";
  owner?: string;
  repo?: string;
  updatedAt: string;
};

const STORAGE_KEY = "resolve-recent-workspaces";

export function loadRecentWorkspaces(): RecentWorkspace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentWorkspace[]) : [];
  } catch {
    return [];
  }
}

export function saveRecentWorkspace(entry: Omit<RecentWorkspace, "updatedAt">) {
  const list = loadRecentWorkspaces().filter((w) => w.id !== entry.id);
  list.unshift({ ...entry, updatedAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 8)));
}

export function WorkspaceSidebar({
  activeId,
  onSelect,
}: {
  activeId?: string | null;
  onSelect: (w: RecentWorkspace) => void;
}) {
  const recent = loadRecentWorkspaces();

  return (
    <aside className="hidden w-56 shrink-0 xl:block">
      <div className="sticky top-[4.5rem] space-y-4">
        <div>
          <p className="px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-resolve-muted-dim">
            Value streams
          </p>
          <Panel variant="glass" className="mt-2 p-4">
            <div className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-sm font-semibold text-white">
                {activeId ? "Deep dive" : "All ecosystems"}
              </p>
            </div>
            <p className="mt-1 truncate text-xs text-resolve-muted">
              {activeId ?? "Unified view across open sources"}
            </p>
          </Panel>
        </div>

        {recent.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-resolve-muted-dim">
                Recent
              </p>
              <Link
                href="/workspace/fund"
                className="rounded-md p-1 text-resolve-muted transition hover:bg-resolve-hover hover:text-white"
                title="New project"
              >
                <Plus className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ul className="mt-2 space-y-1">
              {recent.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(w)}
                    className={clsx(
                      "w-full rounded-lg px-3 py-2 text-left text-sm transition",
                      activeId === w.id
                        ? "border border-resolve-accent/30 bg-resolve-accent/10 text-white"
                        : "text-resolve-muted hover:bg-resolve-hover/60 hover:text-white",
                    )}
                  >
                    <p className="truncate font-medium">{w.label}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-1 px-1">
          <Link href="/activity" className="block text-xs text-resolve-muted hover:text-white">
            Live activity →
          </Link>
          <Link href="/payments" className="block text-xs text-resolve-muted hover:text-white">
            Payments & settlement →
          </Link>
        </div>
      </div>
    </aside>
  );
}
