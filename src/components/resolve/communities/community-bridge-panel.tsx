"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, Music2, Radio } from "lucide-react";
import { toast } from "sonner";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Button } from "@/components/resolve/ui/button";

type BridgeStatus = {
  ok: boolean;
  installed: boolean;
  bridgeHealthy: boolean;
  lastSyncAt: string | null;
  perPlayUsd: number;
  syncEndpoint: string;
  bridgeScript: string;
  program: { missionId: string; name: string | null; communitySlug: string } | null;
  instructions: string;
};

export function CommunityBridgePanel({
  communitySlug,
  onSynced,
}: {
  communitySlug: string;
  onSynced?: () => void;
}) {
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const isMusic = ["independent-music", "navidrome"].includes(communitySlug);

  useEffect(() => {
    if (!isMusic) return;
    const load = () =>
      fetch(`/api/connectors/navidrome/status?community=${communitySlug}`, {
        credentials: "include",
      })
        .then((r) => r.json())
        .then((d: BridgeStatus) => {
          setStatus(d);
          if (d.bridgeHealthy) void onSynced?.();
        })
        .catch(() => setStatus(null))
        .finally(() => setLoading(false));

    void load();
    const t = setInterval(() => void load(), 25_000);
    return () => clearInterval(t);
  }, [communitySlug, onSynced, isMusic]);

  async function copyMissionId() {
    const id = status?.program?.missionId;
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success("Mission ID copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }

  if (!isMusic) return null;

  if (loading) {
    return (
      <BlueGlowCard variant="subtle" className="flex items-center gap-2 text-sm text-resolve-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking scrobble bridge…
      </BlueGlowCard>
    );
  }

  if (!status) return null;

  return (
    <BlueGlowCard variant="subtle" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Music2 className="h-4 w-4 text-resolve-accent" />
          <span className="text-xs font-medium uppercase tracking-wider text-resolve-muted">
            Scrobble bridge
          </span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] ${
            status.bridgeHealthy
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-white/10 bg-white/[0.03] text-resolve-muted"
          }`}
        >
          <Radio className="h-3 w-3" />
          {status.bridgeHealthy ? "Receiving plays" : "Waiting for bridge"}
        </span>
      </div>

      <p className="text-sm text-white/90">{status.instructions}</p>

      {status.program?.missionId && (
        <div className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Your program mission</p>
          <p className="mt-1 font-mono text-xs text-white">{status.program.missionId}</p>
          <p className="mt-1 text-[10px] text-resolve-muted">
            {status.program.name} · ${status.perPlayUsd} per play
          </p>
          <Button type="button" variant="secondary" size="sm" className="mt-2 gap-1.5" onClick={() => void copyMissionId()}>
            {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy mission ID for bridge
          </Button>
        </div>
      )}

      {status.lastSyncAt && (
        <p className="text-[11px] text-resolve-muted-dim">
          Last scrobble: {new Date(status.lastSyncAt).toLocaleString()} · POST {status.syncEndpoint}
        </p>
      )}

      {!status.installed && (
        <p className="text-xs text-amber-200/90">Install RESOLVE on this community to get your mission ID.</p>
      )}
    </BlueGlowCard>
  );
}
