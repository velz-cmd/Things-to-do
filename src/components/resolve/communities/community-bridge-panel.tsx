"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Music2, Radio, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Button } from "@/components/resolve/ui/button";

type SensorStatus = {
  ok: boolean;
  installed: boolean;
  receiving: boolean;
  lastSyncAt: string | null;
  perPlayUsd: number;
  program: { missionId: string; name: string | null; communitySlug: string } | null;
  sensors: { listenBrainz: boolean; navidrome: boolean };
  instructions: string;
};

export function CommunityBridgePanel({
  communitySlug,
  onSynced,
}: {
  communitySlug: string;
  onSynced?: () => void;
}) {
  const [status, setStatus] = useState<SensorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const isMusic = ["independent-music", "navidrome"].includes(communitySlug);

  useEffect(() => {
    if (!isMusic) return;
    const load = () =>
      fetch(`/api/connectors/navidrome/status?community=${communitySlug}`, {
        credentials: "include",
      })
        .then((r) => r.json())
        .then((d: SensorStatus) => {
          setStatus(d);
          if (d.receiving) void onSynced?.();
        })
        .catch(() => setStatus(null))
        .finally(() => setLoading(false));

    void load();
    const t = setInterval(() => void load(), 25_000);
    return () => clearInterval(t);
  }, [communitySlug, onSynced, isMusic]);

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch("/api/connectors/music/sync", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      const n = data.ingested ?? 0;
      toast.success(n > 0 ? `${n} new plays recognized` : "Up to date — keep listening");
      void onSynced?.();
      const refreshed = await fetch(
        `/api/connectors/navidrome/status?community=${communitySlug}`,
        { credentials: "include" },
      ).then((r) => r.json());
      setStatus(refreshed);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not sync");
    } finally {
      setSyncing(false);
    }
  }

  if (!isMusic) return null;

  if (loading) {
    return (
      <BlueGlowCard variant="subtle" className="flex items-center gap-2 text-sm text-resolve-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking music sensor…
      </BlueGlowCard>
    );
  }

  if (!status) return null;

  const connected = status.sensors.listenBrainz || status.sensors.navidrome;

  return (
    <BlueGlowCard variant="subtle" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Music2 className="h-4 w-4 text-resolve-accent" />
          <span className="text-xs font-medium uppercase tracking-wider text-resolve-muted">
            Music sensor
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] ${
            status.receiving
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : connected
                ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
                : "border-white/10 bg-white/[0.03] text-resolve-muted"
          }`}
        >
          <Radio className="h-3 w-3" />
          {status.receiving
            ? "Receiving plays"
            : connected
              ? "Connected — syncing soon"
              : "Not connected"}
        </span>
      </div>

      <p className="text-sm text-white/90">{status.instructions}</p>

      {status.program && (
        <div className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Your program</p>
          <p className="mt-1 text-sm font-medium text-white">{status.program.name}</p>
          <p className="mt-0.5 text-[11px] text-resolve-muted">
            ${status.perPlayUsd} per play · mission handled automatically
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!connected && (
          <Link
            href="/profile"
            className="inline-flex h-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-white hover:bg-white/[0.08]"
          >
            Connect on Profile
          </Link>
        )}
        {connected && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="gap-1.5"
            disabled={syncing}
            onClick={() => void syncNow()}
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Sync now
          </Button>
        )}
      </div>

      {status.lastSyncAt && (
        <p className="text-[11px] text-resolve-muted-dim">
          Last activity: {new Date(status.lastSyncAt).toLocaleString()}
        </p>
      )}
    </BlueGlowCard>
  );
}
