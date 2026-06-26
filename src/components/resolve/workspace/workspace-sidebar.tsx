"use client";

import Link from "next/link";
import clsx from "clsx";
import { Plus } from "lucide-react";
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
    <aside className="hidden w-52 shrink-0 lg:block">
      <div className="sticky top-16 space-y-4">
        <div>
          <p className="px-2 text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
            Value streams
          </p>
          <Panel className="mt-2 p-3">
            <p className="text-sm font-medium text-white">
              {activeId ? "Deep dive" : "All ecosystems"}
            </p>
            <p className="mt-0.5 text-xs text-resolve-muted">
              {activeId ?? "Unified view across open sources"}
            </p>
          </Panel>
        </div>

        {recent.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-2">
              <p className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
                Recent
              </p>
              <Link
                href="/workspace"
                className="text-resolve-muted hover:text-white"
                title="Back to workspace"
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
                      "w-full rounded-md px-2 py-2 text-left text-sm transition",
                      activeId === w.id
                        ? "bg-resolve-hover text-white"
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

        <Link
          href="/payments"
          className="block px-2 text-xs text-resolve-muted hover:text-white"
        >
          Payments & settlement →
        </Link>
      </div>
    </aside>
  );
}
