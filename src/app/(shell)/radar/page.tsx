"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, GitBranch, AlertTriangle, Star } from "lucide-react";
import type { FundingOpportunity } from "@/lib/github/types";
import { PageHeader } from "@/components/resolve/ui/page-header";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import { StatusChip } from "@/components/resolve/ui/status-chip";
import { Panel } from "@/components/resolve/ui/panel";

const PRIORITY_VARIANT: Record<string, "verified" | "running" | "demo"> = {
  critical: "running",
  high: "verified",
  medium: "demo",
};

export default function RadarPage() {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<FundingOpportunity[]>([]);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customOwner, setCustomOwner] = useState("");
  const [customRepo, setCustomRepo] = useState("");

  useEffect(() => {
    void fetch("/api/github/opportunities")
      .then((r) => r.json())
      .then((d) => {
        setOpportunities(d.opportunities ?? []);
        setTokenConfigured(Boolean(d.tokenConfigured));
      })
      .finally(() => setLoading(false));
  }, []);

  function fundRepo(owner: string, repo: string) {
    router.push(`/weight?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`);
  }

  return (
    <div className="resolve-grid-bg mx-auto max-w-4xl space-y-8 px-4 py-8 pb-32 lg:px-8">
      <PageHeader
        title="Radar"
        subtitle="Discover high-value, underfunded open source — then prove who deserves capital."
      />

      <GlassPanel className="flex items-start gap-3 p-4">
        <GitBranch className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-white">GitHub opportunity feed</p>
            {tokenConfigured ? (
              <StatusChip label="Live API" variant="verified" />
            ) : (
              <StatusChip label="Limited — set GITHUB_TOKEN" variant="demo" />
            )}
          </div>
          <p className="mt-1 text-xs text-resolve-muted">
            RESOLVE scans repo health, maintainer stress, and recent high-impact PRs.
            Money is easy — knowing where it should go is hard.
          </p>
        </div>
      </GlassPanel>

      <Panel className="p-4">
        <p className="text-xs font-medium text-white">Connect your repository</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={customOwner}
            onChange={(e) => setCustomOwner(e.target.value)}
            placeholder="owner"
            className="w-32 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-sky-500/40"
          />
          <span className="self-center text-resolve-muted">/</span>
          <input
            value={customRepo}
            onChange={(e) => setCustomRepo(e.target.value)}
            placeholder="repo"
            className="flex-1 min-w-[120px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-sky-500/40"
          />
          <button
            type="button"
            disabled={!customOwner || !customRepo}
            onClick={() => fundRepo(customOwner, customRepo)}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
          >
            Analyze & fund
          </button>
        </div>
      </Panel>

      {loading ? (
        <p className="text-sm text-resolve-muted">Scanning GitHub for unfunded value…</p>
      ) : (
        <div className="space-y-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
            {opportunities.length} opportunities indexed
          </p>
          {opportunities.map((opp) => (
            <GlassPanel key={opp.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">{opp.fullName}</p>
                    <StatusChip
                      label={opp.priority}
                      variant={PRIORITY_VARIANT[opp.priority] ?? "demo"}
                    />
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                      Health {opp.health.grade}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-blue-200">{opp.headline}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-resolve-muted">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {opp.stars.toLocaleString()}
                    </span>
                    <span>{opp.forks.toLocaleString()} forks</span>
                    <span>{opp.highImpactPrs} high-impact PRs</span>
                    <span>~${opp.health.fundingGapUsd.toLocaleString()} funding gap</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => fundRepo(opp.owner, opp.repo)}
                  className="inline-flex items-center gap-1 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-400"
                >
                  Fund this repo
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {opp.health.maintainerCount <= 1 && opp.stars > 1000 && (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {opp.health.maintainerCount} active maintainer · {opp.stars.toLocaleString()} stars · $0 transparent payouts detected
                </div>
              )}

              <ul className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {opp.health.signals.map((s) => (
                  <li
                    key={s.label}
                    className="rounded border border-white/[0.06] bg-black/20 px-2 py-1.5 text-[11px]"
                  >
                    <span className="text-resolve-muted">{s.label}</span>
                    <p className="font-medium text-white">{s.value}</p>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-resolve-muted">
        Phase 1: GitHub only. Discord, X, Mastodon expand after the engine proves value on code.
        {" "}
        <Link href="/protocol" className="text-sky-400 hover:underline">
          Protocol spec
        </Link>
      </p>
    </div>
  );
}
