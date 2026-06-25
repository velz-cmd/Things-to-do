"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { ChevronRight, Search } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import type { FundingOpportunity } from "@/lib/github/types";

export function WorkspaceOpportunities({
  onSelect,
}: {
  onSelect: (owner: string, repo: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FundingOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!open || items.length > 0) return;
    setLoading(true);
    void fetch("/api/github/opportunities")
      .then((r) => r.json())
      .then((d) => {
        setItems(d.opportunities ?? []);
        setLive(Boolean(d.tokenConfigured));
      })
      .finally(() => setLoading(false));
  }, [open, items.length]);

  const filtered = items.filter((o) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return o.fullName.toLowerCase().includes(q) || o.headline.toLowerCase().includes(q);
  });

  return (
    <Panel className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.02]"
      >
        <div>
          <p className="text-sm font-medium text-white">Browse unfunded repositories</p>
          <p className="text-xs text-resolve-muted">
            Don&apos;t have a repo in mind? Pick from live GitHub opportunities.
          </p>
        </div>
        <ChevronRight className={clsx("h-4 w-4 text-resolve-muted transition", open && "rotate-90")} />
      </button>

      {open && (
        <div className="border-t border-resolve-border px-4 pb-4">
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-resolve-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search repositories…"
              className="w-full rounded-lg border border-resolve-border bg-resolve-bg py-2 pl-8 pr-3 text-sm text-white placeholder:text-resolve-muted-dim"
            />
          </div>

          {loading ?
            <p className="mt-3 text-sm text-resolve-muted">Loading opportunities…</p>
          : filtered.length === 0 ?
            <p className="mt-3 text-sm text-resolve-muted">No matches. Paste a repo URL above instead.</p>
          : <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {filtered.slice(0, 12).map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(o.owner, o.repo)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-resolve-hover"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{o.fullName}</p>
                      <p className="truncate text-xs text-resolve-muted">{o.headline}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-amber-300">
                        ${o.health.fundingGapUsd.toLocaleString()} gap
                      </p>
                      <p className="text-[10px] text-resolve-muted">
                        Health {o.health.grade}
                        {live ? " · live" : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          }
        </div>
      )}
    </Panel>
  );
}
