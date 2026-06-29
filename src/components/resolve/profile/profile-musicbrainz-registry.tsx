"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Music, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { Panel } from "@/components/resolve/ui/panel";
import { Button } from "@/components/resolve/ui/button";
import { MonoHash } from "@/components/resolve/ui/money";
import { useResolveAccount } from "@/hooks/use-resolve-account";

type ArtistHit = {
  mbid: string;
  name: string;
  disambiguation?: string;
  type?: string;
  linked?: boolean;
  walletAddress?: string | null;
  verified?: boolean;
};

export function ProfileMusicBrainzRegistry() {
  const account = useResolveAccount();
  const payoutWallet =
    account.appWalletAddress ?? account.walletAddress ?? account.externalWalletAddress;

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [results, setResults] = useState<ArtistHit[]>([]);
  const [linkedArtist, setLinkedArtist] = useState<ArtistHit | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/registry/musicbrainz/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.artists ?? []);
    } catch {
      toast.error("Could not search MusicBrainz");
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void search(query), 350);
    return () => clearTimeout(t);
  }, [query, search]);

  async function linkArtist(artist: ArtistHit) {
    if (!payoutWallet) {
      toast.error("Connect a wallet first — royalties settle to your Arc address");
      return;
    }
    setLinking(artist.mbid);
    try {
      const res = await fetch("/api/registry/musicbrainz/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mbid: artist.mbid,
          artistName: artist.name,
          walletAddress: payoutWallet,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Link failed");
      toast.success(`Linked ${artist.name} → your wallet`);
      setLinkedArtist({ ...artist, linked: true, walletAddress: payoutWallet, verified: true });
      setResults((prev) =>
        prev.map((a) =>
          a.mbid === artist.mbid ?
            { ...a, linked: true, walletAddress: payoutWallet, verified: true }
          : a,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not link artist");
    } finally {
      setLinking(null);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-white">Artist registry</h2>
        <p className="mt-0.5 text-xs text-resolve-muted">
          Link your MusicBrainz artist name to your wallet — plays and credits route royalties to you.
        </p>
      </div>

      <Panel variant="flat" className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-resolve-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search MusicBrainz artist name…"
            className="w-full rounded-xl border border-white/[0.08] bg-[#0a0f18] py-3 pl-10 pr-4 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none"
          />
        </div>

        {!payoutWallet && (
          <p className="flex items-center gap-2 text-xs text-amber-200/90">
            <Wallet className="h-3.5 w-3.5 shrink-0" />
            Connect a wallet above before linking an artist for payouts.
          </p>
        )}

        {linkedArtist && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{linkedArtist.name}</p>
                <p className="text-[11px] text-resolve-muted">Linked to your wallet</p>
                {linkedArtist.walletAddress && (
                  <MonoHash value={linkedArtist.walletAddress} className="mt-1 block text-[10px]" />
                )}
              </div>
            </div>
          </div>
        )}

        {searching && (
          <p className="flex items-center gap-2 text-xs text-resolve-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching MusicBrainz…
          </p>
        )}

        {!searching && results.length > 0 && (
          <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
            {results.map((artist) => (
              <li
                key={artist.mbid}
                className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-white/[0.02]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Music className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                    <p className="truncate text-sm font-medium text-white">{artist.name}</p>
                    {artist.linked && (
                      <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-300">
                        Linked
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-resolve-muted">
                    {[artist.type, artist.disambiguation].filter(Boolean).join(" · ") ||
                      artist.mbid}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={artist.linked ? "secondary" : "primary"}
                  disabled={artist.linked || linking === artist.mbid || !payoutWallet}
                  onClick={() => void linkArtist(artist)}
                  className={clsx("shrink-0")}
                >
                  {linking === artist.mbid ?
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : artist.linked ?
                    "Linked"
                  : "Link wallet"}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {!searching && query.length >= 2 && results.length === 0 && (
          <p className="text-xs text-resolve-muted">No artists found — try a different spelling.</p>
        )}
      </Panel>
    </section>
  );
}
