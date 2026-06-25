"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  musicbrainzId: string | null;
  activitypubActor: string | null;
}

export function RegistryPanel({ embedded }: { embedded?: boolean }) {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [mbid, setMbid] = useState("");
  const [wallet, setWallet] = useState("");
  const [artistName, setArtistName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const registerMbid = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!mbid.trim() || !wallet.startsWith("0x")) {
      setMessage("MusicBrainz ID and valid wallet (0x…) required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/registry/musicbrainz/${encodeURIComponent(mbid.trim())}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: wallet.trim(),
          artistName: artistName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Registration failed");
        return;
      }
      setMbid("");
      setWallet("");
      setArtistName("");
      setMessage("Artist registered — scrobbles can now route payouts to this wallet.");
      await load();
    } catch {
      setMessage("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const identity = (c: Contributor) =>
    c.musicbrainzId ??
    c.githubUsername ??
    c.exifArtist ??
    c.activitypubActor ??
    c.platform ??
    "—";

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

      <Panel className="mb-4">
        <p className="text-xs font-medium text-white">MusicBrainz payee signup</p>
        <p className="mt-1 text-[11px] text-resolve-muted">
          Navidrome operators: register artist MBIDs so scrobbles resolve to the right wallet.{" "}
          <Link href="/music" className="text-resolve-accent hover:underline">
            Setup guide
          </Link>
        </p>
        <form onSubmit={registerMbid} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={mbid}
            onChange={(e) => setMbid(e.target.value)}
            placeholder="MusicBrainz artist ID (MBID)"
            className="rounded border border-resolve-border bg-resolve-bg px-2 py-1.5 text-xs text-white"
          />
          <input
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="Display name (optional)"
            className="rounded border border-resolve-border bg-resolve-bg px-2 py-1.5 text-xs text-white"
          />
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Payout wallet (0x…)"
            className="rounded border border-resolve-border bg-resolve-bg px-2 py-1.5 text-xs text-white sm:col-span-2"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-resolve-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 sm:col-span-2 sm:w-fit"
          >
            {submitting ? "Registering…" : "Register artist"}
          </button>
        </form>
        {message && <p className="mt-2 text-[11px] text-resolve-muted">{message}</p>}
      </Panel>

      <Panel className="overflow-hidden p-0">
        {loading ? (
          <div className="p-3">
            <TableSkeleton rows={4} />
          </div>
        ) : !contributors.length ? (
          <EmptyState
            icon={Users}
            title="No contributors"
            description="Seed treasury to load demo payees, or register an artist above."
            className="border-0 py-6"
          />
        ) : (
          <ul className="divide-y divide-resolve-border text-xs">
            {contributors.slice(0, 12).map((c) => (
              <li key={c.id} className="px-3 py-2 hover:bg-resolve-hover/40">
                <p className="font-medium text-white">{c.creatorName ?? "—"}</p>
                <p className="text-resolve-muted">{identity(c)}</p>
                <MonoHash value={c.walletAddress} className="mt-0.5 block text-[10px]" />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
