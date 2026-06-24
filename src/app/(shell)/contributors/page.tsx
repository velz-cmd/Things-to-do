"use client";

import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/resolve/ui/panel";
import { TableSkeleton } from "@/components/resolve/ui/skeleton";
import { EmptyState } from "@/components/resolve/ui/empty-state";
import { Users } from "lucide-react";
import { MonoHash } from "@/components/resolve/ui/money";

interface Contributor {
  id: string;
  platform: string | null;
  platformId: string | null;
  creatorName: string | null;
  walletAddress: string;
  githubUsername: string | null;
  exifArtist: string | null;
  verified: boolean;
}

export default function ContributorsPage() {
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
    <div className="mx-auto max-w-5xl animate-resolve-enter px-6 py-6">
      <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
        Registry
      </p>
      <h1 className="mt-1 text-xl font-semibold text-white">Contributors</h1>
      <p className="mt-1 text-sm text-resolve-muted">
        Attribution → Arc wallet. Who gets paid when events verify.
      </p>

      <Panel className="mt-6 p-0 overflow-hidden">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={6} />
          </div>
        ) : !contributors.length ? (
          <EmptyState
            icon={Users}
            title="No contributors registered"
            description="Seed the demo registry from Treasury to resolve payees in distribution batches."
            className="border-0"
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-resolve-border bg-resolve-bg text-[10px] uppercase text-resolve-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Creator</th>
                <th className="px-5 py-2.5 font-medium">Platform</th>
                <th className="px-5 py-2.5 font-medium">Attribution</th>
                <th className="px-5 py-2.5 font-medium">Wallet</th>
              </tr>
            </thead>
            <tbody>
              {contributors.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-resolve-border hover:bg-resolve-hover/40"
                >
                  <td className="px-5 py-3 text-white">{c.creatorName ?? "—"}</td>
                  <td className="px-5 py-3 text-resolve-muted">{c.platform ?? "—"}</td>
                  <td className="px-5 py-3 text-resolve-muted">
                    {c.githubUsername ?? c.exifArtist ?? c.platformId ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <MonoHash value={c.walletAddress} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
