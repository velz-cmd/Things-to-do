"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, LayoutList, Landmark, Users } from "lucide-react";
import { HeroVisual } from "@/components/resolve/home/hero-visual";
import { LiveMissionPreview } from "@/components/resolve/home/live-mission-preview";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";

export function HomePage() {
  const [stats, setStats] = useState({
    settled: 0,
    batches: 0,
    contributors: 0,
  });

  useEffect(() => {
    void fetch("/api/treasury")
      .then((r) => r.json())
      .then((d) =>
        setStats({
          settled: d.totalDistributedUsd ?? 0,
          batches: d.batchCount ?? 0,
          contributors: d.contributorCount ?? 0,
        }),
      )
      .catch(() => {});
  }, []);

  return (
    <div className="resolve-grid-bg min-h-screen pb-16">
      <section className="relative overflow-hidden px-4 pb-10 pt-10 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-resolve-accent">
              Outcome network on Arc
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white md:text-4xl">
              Work gets funded
              <span className="text-blue-300"> only when verified.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-resolve-muted">
              Bounties, team payouts, and community distribution — one mission control with
              guided setup, treasury, and proof-based settlement.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/missions"
                className="inline-flex items-center gap-2 rounded-md bg-resolve-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Start guided setup
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/radar"
                className="inline-flex items-center gap-2 rounded-md border border-resolve-border-strong px-5 py-2.5 text-sm text-white hover:bg-resolve-hover"
              >
                Open radar
              </Link>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-8 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-3">
          <Panel className="p-4">
            <div className="flex items-center gap-2 text-resolve-muted">
              <Landmark className="h-4 w-4 text-resolve-accent" />
              <span className="text-[10px] uppercase">Treasury settled</span>
            </div>
            <Money amount={stats.settled} size="md" className="mt-2" />
          </Panel>
          <Panel className="p-4">
            <div className="flex items-center gap-2 text-resolve-muted">
              <LayoutList className="h-4 w-4 text-resolve-accent" />
              <span className="text-[10px] uppercase">Batches</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{stats.batches}</p>
          </Panel>
          <Panel className="p-4">
            <div className="flex items-center gap-2 text-resolve-muted">
              <Users className="h-4 w-4 text-resolve-accent" />
              <span className="text-[10px] uppercase">Contributors</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
              {stats.contributors}
            </p>
          </Panel>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Live mission preview</h2>
              <p className="mt-1 text-sm text-resolve-muted">
                Proof-based payment — no payout without verification.
              </p>
            </div>
            <Link href="/missions" className="text-xs text-resolve-accent hover:underline">
              Mission control →
            </Link>
          </div>
          <div className="mt-4">
            <LiveMissionPreview />
          </div>
        </div>
      </section>
    </div>
  );
}
