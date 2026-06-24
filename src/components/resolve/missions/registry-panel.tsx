"use client";

import { useCallback, useEffect, useState } from "react";
import { Users } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { TableSkeleton } from "@/components/resolve/ui/skeleton";
import { EmptyState } from "@/components/resolve/ui/empty-state";
import { MonoHash } from "@/components/resolve/ui/money";

interface Contributor {
  id: string;
  platform: string | null;
  creatorName: string | null;
  walletAddress: string;
  githubUsername: string | null;
  exifArtist: string | null;
}

export function RegistryPanel({ embedded }: { embedded?: boolean }) {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    await fetch("/api/treasury", { method: "POST" });
    const res = await fetch("/api/registry");
    const data = await res.json();
    setContributors(data.contributors ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={embedded ? "p-3" : "mx-auto max-w-5xl px-6 py-6"}>
      {!embedded && (
        <div className="mb-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
            Registry
          </p>
          <h1 className="mt-1 text-xl font-semibold text-white">Contributors</h1>
        </div>
      )}

      <Panel className="overflow-hidden p-0">
        {loading ? (
          <div className="p-3">
            <TableSkeleton rows={4} />
          </div>
        ) : !contributors.length ? (
          <EmptyState
            icon={Users}
            title="No contributors"
            description="Seed treasury to load demo payees."
            className="border-0 py-6"
          />
        ) : (
          <ul className="divide-y divide-resolve-border text-xs">
            {contributors.slice(0, 8).map((c) => (
              <li key={c.id} className="px-3 py-2 hover:bg-resolve-hover/40">
                <p className="font-medium text-white">{c.creatorName ?? "—"}</p>
                <p className="text-resolve-muted">
                  {c.githubUsername ?? c.exifArtist ?? c.platform ?? "—"}
                </p>
                <MonoHash value={c.walletAddress} className="mt-0.5 block text-[10px]" />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
