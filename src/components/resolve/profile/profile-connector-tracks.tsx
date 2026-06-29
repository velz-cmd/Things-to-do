"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Music2, GitBranch, BookOpen, Tv, RefreshCw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/resolve/ui/button";
import { Money } from "@/components/resolve/ui/money";

type TrackStatus = {
  id: string;
  name: string;
  event: string;
  connector: string;
  description: string;
  connectorReady: boolean;
  installed: boolean;
  communitySlugs: string[];
  authorizationCount: number;
  authorizedUsd: number;
  live: boolean;
  programs: Array<{ name: string; eventType: string; authorizationCount: number }>;
};

const ICONS = {
  music: Music2,
  oss: GitBranch,
  research: BookOpen,
  media: Tv,
} as const;

export function ProfileConnectorTracks() {
  const [tracks, setTracks] = useState<TrackStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    void fetch("/api/connectors/phase3/status", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => setTracks(body.tracks ?? []))
      .catch(() => setTracks([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function syncAll() {
    setSyncing(true);
    try {
      const res = await fetch("/api/connectors/sensors/sync", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      const n = data.ingested ?? 0;
      toast.success(
        n > 0 ? `${n} new signal(s) recognized across tracks` : "Sensors up to date",
      );
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sync sensors");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-resolve-accent">
          Connector tracks
        </p>
        <div className="flex items-center gap-2 text-sm text-resolve-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading programs…
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-resolve-accent">
            Connector tracks
          </p>
          <h2 className="mt-1 text-sm font-semibold text-white">Phase 3 — live programs</h2>
          <p className="mt-0.5 text-xs text-resolve-muted">
            Music · Open source · Research · Video — same settlement core, parallel sensors
          </p>
        </div>
        <Button size="sm" variant="secondary" disabled={syncing} onClick={() => void syncAll()}>
          {syncing ?
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Sync sensors
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tracks.map((track) => {
          const Icon = ICONS[track.id as keyof typeof ICONS] ?? Music2;
          const community = track.communitySlugs[0];
          return (
            <div
              key={track.id}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-resolve-accent/10">
                    <Icon className="h-4 w-4 text-resolve-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{track.name}</p>
                    <p className="font-mono text-[10px] text-resolve-muted-dim">{track.event}</p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    track.live ?
                      "bg-emerald-500/15 text-emerald-300"
                    : track.connectorReady ?
                      "bg-amber-500/15 text-amber-200"
                    : "bg-white/5 text-resolve-muted-dim"
                  }`}
                >
                  {track.live ? "Live" : track.connectorReady ? "Ready" : "Connect"}
                </span>
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-resolve-muted-dim">
                {track.description}
              </p>

              <div className="mt-3 flex items-baseline justify-between text-xs">
                <span className="text-resolve-muted">Authorizations</span>
                <span className="tabular-nums text-white">{track.authorizationCount}</span>
              </div>
              {track.authorizedUsd > 0 && (
                <div className="mt-1 flex items-baseline justify-between text-xs">
                  <span className="text-resolve-muted">Recognized</span>
                  <Money amount={track.authorizedUsd} size="sm" className="text-emerald-300" />
                </div>
              )}

              {community && (
                <Link
                  href={`/communities/${community}`}
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-resolve-accent hover:underline"
                >
                  Open program
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
