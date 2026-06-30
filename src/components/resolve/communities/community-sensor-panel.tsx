"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Radio, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Button } from "@/components/resolve/ui/button";

type SyncResponse = {
  ok: boolean;
  observations?: number;
  ingested?: number;
  skipped?: number;
  eventTypes?: string[];
  reposScanned?: string[];
  live?: boolean;
  qfMatches?: number;
  matchLeverage?: number;
  error?: string;
};

const GITHUB_SLUGS = new Set(["react", "linux"]);
const RESEARCH_SLUG = "open-research";
const QF_SLUGS = new Set(["react"]);

type Props = {
  slug: string;
  installed?: boolean;
  onSynced?: () => void | Promise<void>;
};

export function CommunitySensorPanel({ slug, installed = true, onSynced }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [last, setLast] = useState<SyncResponse | null>(null);
  const [sensorReady, setSensorReady] = useState<boolean | null>(null);

  const isResearch = slug === RESEARCH_SLUG;
  const isQf = QF_SLUGS.has(slug);
  const isGithub = GITHUB_SLUGS.has(slug);

  const endpoint =
    isResearch ? "/api/connectors/openalex/sync"
    : isQf ? "/api/connectors/opencollective/sync"
    : "/api/connectors/github/sync";

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/communities/sensor-status");
      if (!res.ok) return;
      const data = (await res.json()) as {
        statuses?: Array<{ slug: string; sensorReady: boolean; sensorLive: boolean }>;
      };
      const row = data.statuses?.find((s) => s.slug === slug);
      if (row) setSensorReady(row.sensorReady);
    } catch {
      /* optional */
    }
  }, [slug]);

  useEffect(() => {
    if (isGithub || isResearch || isQf) void loadStatus();
  }, [slug, loadStatus, isGithub, isResearch, isQf]);

  if (!isGithub && !isResearch && !isQf) return null;

  async function runSync() {
    if (!installed) {
      toast.message("Install RESOLVE on this community first");
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ communitySlug: slug }),
      });
      const data = (await res.json()) as SyncResponse;
      setLast(data);
      if (!res.ok) {
        toast.error(data.error ?? "Could not refresh sensors");
        return;
      }
      if ((data.ingested ?? 0) > 0) {
        toast.success(`${data.ingested} new authorization(s) from live sensors`);
      } else if ((data.observations ?? 0) > 0) {
        toast.message("Sensors checked — no new authorizations (already in ledger)");
      } else {
        toast.message("Sensors ran — no new events in this slice yet");
      }
      await onSynced?.();
      await loadStatus();
    } catch {
      toast.error("Could not reach sensor API");
    } finally {
      setSyncing(false);
    }
  }

  const description =
    isResearch ? "Pulls new OpenAlex citations into the authorization ledger."
    : isQf ?
      "Pulls Open Collective contributions, scores QF, and creates match authorizations."
    : "Pulls merged docs PRs and security issues from GitHub into the ledger.";

  return (
    <div className="space-y-3">
      <BlueGlowCard variant="subtle" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-resolve-accent" />
            <span className="text-xs font-medium uppercase tracking-wider text-resolve-muted">
              Live sensors
            </span>
          </div>
          {sensorReady === false && (
            <span className="text-[10px] text-amber-400/90">Platform keys pending</span>
          )}
        </div>
        <p className="text-sm text-white/90">{description}</p>
        {!installed && (
          <p className="text-xs text-resolve-muted">
            Install RESOLVE above, then use Refresh sensors to load live fair-pay events.
          </p>
        )}
        {last && (
          <p className="text-[11px] leading-relaxed text-resolve-muted-dim">
            Last refresh: {last.observations ?? 0} observation(s) · {last.ingested ?? 0} new in ledger
            {last.eventTypes?.length ? ` · ${last.eventTypes.join(", ")}` : ""}
            {last.reposScanned?.length ? ` · ${last.reposScanned.join(", ")}` : ""}
            {last.matchLeverage ? ` · ${last.matchLeverage.toFixed(2)}× match leverage` : ""}
          </p>
        )}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={syncing || !installed}
          onClick={() => void runSync()}
          className="gap-2"
          title={installed ? "Fetch latest sensor events" : "Install this community first"}
        >
          {syncing ?
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh sensors
        </Button>
      </BlueGlowCard>

      {isQf && (
        <p className="text-[11px] text-resolve-muted">
          <Link
            href="https://opencollective.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-resolve-accent hover:underline"
          >
            Open Collective
            <ArrowUpRight className="h-3 w-3" />
          </Link>{" "}
          contributions are recognized signals — funders seed the match pool on Arc.
        </p>
      )}
    </div>
  );
}
