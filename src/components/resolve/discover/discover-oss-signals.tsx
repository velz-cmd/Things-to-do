"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, GitBranch, Plug, Wallet } from "lucide-react";
import type { FundingOpportunity } from "@/lib/github/types";

const PRIORITY_STYLES = {
  critical: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  high: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  medium: "border-resolve-border/60 text-resolve-muted",
} as const;

type DiscoverOssSignalsProps = {
  query?: string;
  onInstallOss?: () => void;
  className?: string;
};

function repoEntityPath(owner: string, repo: string) {
  return `/e/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

/** Live GitHub funding gaps — view entity, install OSS rail, jump to fulfill queue. */
export function DiscoverOssSignals({
  query = "",
  onInstallOss,
  className,
}: DiscoverOssSignalsProps) {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<FundingOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/github/opportunities")
      .then((r) => r.json())
      .then((d) => setOpportunities(d.opportunities ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return opportunities;
    return opportunities.filter(
      (o) =>
        o.fullName.toLowerCase().includes(q) ||
        o.headline.toLowerCase().includes(q) ||
        o.owner.toLowerCase().includes(q) ||
        o.repo.toLowerCase().includes(q),
    );
  }, [opportunities, query]);

  return (
    <section id="oss-signals" className={className}>
      <div className="mb-4 flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-resolve-accent" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
            OSS signals
          </p>
          <p className="mt-1 text-xs text-resolve-muted">
            Underfunded maintainers from live GitHub scans — open the entity, install the OSS rail, or
            fulfill programs below.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-resolve-muted">Scanning open ecosystems…</p>
      ) : !filtered.length ? (
        <p className="text-sm text-resolve-muted">
          {query.trim() ? "No OSS signals match your search." : "No OSS signals yet — check back after sensor sync."}
        </p>
      ) : (
        <ul className="divide-y divide-resolve-border/60 rounded-xl border border-resolve-border/60 bg-resolve-bg-deep/25">
          {filtered.slice(0, 12).map((o) => (
            <li key={o.fullName} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-white">{o.fullName}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase ${PRIORITY_STYLES[o.priority]}`}
                  >
                    {o.priority}
                  </span>
                  {o.live && (
                    <span className="text-[9px] uppercase text-emerald-400/80">live scan</span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-resolve-muted">{o.headline}</p>
                <p className="mt-1 text-[11px] text-resolve-muted-dim">
                  {o.stars.toLocaleString()} stars · gap ~$
                  {o.health.fundingGapUsd.toFixed(0)} · {o.unfundedMaintainers} maintainers
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => router.push(repoEntityPath(o.owner, o.repo))}
                  className="inline-flex items-center gap-1 rounded-lg border border-resolve-accent/30 px-3 py-1.5 text-xs font-medium text-resolve-accent hover:bg-resolve-accent/10"
                >
                  <ExternalLink className="h-3 w-3" />
                  View
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onInstallOss?.();
                    document.getElementById("communities")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-resolve-border/60 px-3 py-1.5 text-xs text-resolve-muted hover:text-white"
                >
                  <Plug className="h-3 w-3" />
                  Install OSS
                </button>
                <a
                  href="#opportunities"
                  className="inline-flex items-center gap-1 rounded-lg border border-resolve-border/60 px-3 py-1.5 text-xs text-resolve-muted hover:text-white"
                >
                  <Wallet className="h-3 w-3" />
                  Fund
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-resolve-muted-dim">
        Entity pages show maintainer graphs and authorization history —{" "}
        <Link href="/program" className="text-resolve-accent hover:underline">
          see how OSS programs work
        </Link>
      </p>
    </section>
  );
}
