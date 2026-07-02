"use client";

import Link from "next/link";
import clsx from "clsx";
import { Plus, Radio } from "lucide-react";
import {
  loadRecentWorkspaces,
  type RecentWorkspace,
} from "@/lib/workspace/workspace-recent";

export function WorkspaceFundSidebar({
  activeId,
  onSelect,
}: {
  activeId?: string | null;
  onSelect: (w: RecentWorkspace) => void;
}) {
  const recent = loadRecentWorkspaces();

  return (
    <aside className="hidden w-52 shrink-0 xl:block">
      <div className="sticky top-[4.5rem] space-y-4">
        <div className="rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Radio className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-sm font-semibold text-white">
              {activeId ? "Deep dive" : "All ecosystems"}
            </p>
          </div>
          <p className="mt-1 truncate text-xs text-resolve-muted">
            {activeId ?? "Unified view across open sources"}
          </p>
        </div>

        {recent.length > 0 && (
          <div>
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-resolve-muted-dim">
                Recent
              </p>
              <Link
                href="/mission"
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
      </div>
    </aside>
  );
}
