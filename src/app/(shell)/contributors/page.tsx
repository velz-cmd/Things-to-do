"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";

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

  const load = useCallback(async () => {
    await fetch("/api/treasury", { method: "POST" });
    const res = await fetch("/api/registry");
    const data = await res.json();
    setContributors(data.contributors ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
      <p className="text-sm font-medium text-sky-400">Attribution layer</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Contributors</h1>
      <p className="mt-2 max-w-2xl text-resolve-muted">
        Who gets paid — GitHub, MusicBrainz, EXIF Artist, ActivityPub actor, or platform
        ID mapped to Arc wallets.
      </p>

      <GlassPanel className="mt-8 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase text-resolve-muted">
            <tr>
              <th className="px-4 py-3">Creator</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3">Attribution</th>
              <th className="px-4 py-3">Wallet</th>
            </tr>
          </thead>
          <tbody>
            {contributors.map((c) => (
              <tr key={c.id} className="border-b border-white/5">
                <td className="px-4 py-3 text-white">{c.creatorName ?? "—"}</td>
                <td className="px-4 py-3 text-resolve-muted">{c.platform ?? "generic"}</td>
                <td className="px-4 py-3 text-resolve-muted">
                  {c.githubUsername ?? c.exifArtist ?? c.platformId ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-sky-300/80">
                  {c.walletAddress.slice(0, 10)}…{c.walletAddress.slice(-6)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!contributors.length && (
          <p className="p-6 text-sm text-resolve-muted">
            No contributors yet. Seed from Treasury page.
          </p>
        )}
      </GlassPanel>
    </div>
  );
}
