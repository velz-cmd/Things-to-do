"use client";

import { useState } from "react";
import { Loader2, Radio, Zap } from "lucide-react";
import { toast } from "sonner";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Button } from "@/components/resolve/ui/button";

type SyncResponse = {
  ok: boolean;
  observations?: number;
  ingested?: number;
  eventTypes?: string[];
  reposScanned?: string[];
  live?: boolean;
  error?: string;
};

const SENSOR_SLUGS = new Set(["react", "linux", "open-research"]);

export function CommunitySensorPanel({ slug }: { slug: string }) {
  const [syncing, setSyncing] = useState(false);
  const [last, setLast] = useState<SyncResponse | null>(null);

  if (!SENSOR_SLUGS.has(slug)) return null;

  const isResearch = slug === "open-research";
  const endpoint = isResearch ? "/api/connectors/openalex/sync" : "/api/connectors/github/sync";

  async function runSync() {
    setSyncing(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isResearch ? { communitySlug: slug } : { communitySlug: slug }),
      });
      const data = (await res.json()) as SyncResponse;
      setLast(data);
      if (!res.ok) {
        toast.error(data.error ?? "Sensor sync failed");
        return;
      }
      if ((data.ingested ?? 0) > 0) {
        toast.success(`${data.ingested} authorization(s) from sensor`);
      } else {
        toast.message("Sensor ran — no new authorizations (check API keys or targets)");
      }
    } catch {
      toast.error("Sensor sync unreachable");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <BlueGlowCard variant="subtle" className="space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-resolve-accent" />
        <span className="text-xs font-medium uppercase tracking-wider text-resolve-muted">
          Fair-pay sensor
        </span>
      </div>
      <p className="text-sm text-white/90">
        {isResearch
          ? "OpenAlex citation toll (RFB #2) — sensor → observation → authorization"
          : "GitHub docs + security (RFB #3 / #4) — sensor → observation → authorization"}
      </p>
      {last && (
        <p className="text-[11px] text-resolve-muted-dim">
          Last run: {last.observations ?? 0} observations · {last.ingested ?? 0} ingested
          {last.eventTypes?.length ? ` · ${last.eventTypes.join(", ")}` : ""}
          {last.reposScanned?.length ? ` · ${last.reposScanned.join(", ")}` : ""}
        </p>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={syncing}
        onClick={() => void runSync()}
        className="gap-2"
      >
        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
        Run sensor sync
      </Button>
    </BlueGlowCard>
  );
}
