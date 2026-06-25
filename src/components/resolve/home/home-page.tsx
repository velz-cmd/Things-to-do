"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Scale, Search, Landmark } from "lucide-react";
import { HeroVisual } from "@/components/resolve/home/hero-visual";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";

const LOOP = [
  {
    step: "01",
    verb: "Discover",
    icon: Search,
    copy: "Find hidden builders — maintainers with 300+ PRs and $0 funding, artists with 14k scrobbles and no registry.",
    href: "/discover",
  },
  {
    step: "02",
    verb: "Weight",
    icon: Scale,
    copy: "Seven signals score every contribution. Not all PRs or plays are equal — see AI rationale before money moves.",
    href: "/methodology",
  },
  {
    step: "03",
    verb: "Settle",
    icon: Landmark,
    copy: "Proportional USDC batch on Arc. Arcscan links to the weight proof hash — not a black-box CSV payout.",
    href: "/missions?panel=distribute",
  },
];

export function HomePage() {
  const [stats, setStats] = useState({ settled: 0, builders: 5 });

  useEffect(() => {
    void Promise.all([
      fetch("/api/treasury").then((r) => r.json()),
      fetch("/api/discover/builders").then((r) => r.json()),
    ])
      .then(([treasury, discovery]) =>
        setStats({
          settled: treasury.totalDistributedUsd ?? 0,
          builders: discovery.discovered ?? 5,
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
              Impact-weighted distribution
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white md:text-4xl">
              Find who deserves
              <span className="text-blue-300"> to be paid.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-resolve-muted">
              Not a payment rail. A valuation oracle — discover overlooked contributors, weight
              their impact, settle proportionally on Arc. One verb:{" "}
              <span className="text-white">weight, then pay.</span>
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                href="/discover"
                className="inline-flex items-center gap-2 rounded-md bg-resolve-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Discover hidden builders
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/missions?panel=distribute"
                className="inline-flex items-center gap-2 rounded-md border border-resolve-border-strong px-5 py-2.5 text-sm text-white hover:bg-resolve-hover"
              >
                Verify weight
              </Link>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-lg font-semibold text-white">One loop</h2>
          <p className="mt-1 text-sm text-resolve-muted">
            Like Mimir settles truth and Rug Jeez prices confidence — RESOLVE weights impact.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {LOOP.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.step} href={item.href} className="group">
                  <Panel className="h-full p-4 transition hover:border-resolve-accent/40">
                    <p className="text-[10px] font-medium text-resolve-muted">{item.step}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-resolve-accent" />
                      <p className="text-base font-semibold text-white group-hover:text-blue-200">
                        {item.verb}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-resolve-muted">{item.copy}</p>
                  </Panel>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-8 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2">
          <Panel className="p-4">
            <p className="text-[10px] uppercase text-resolve-muted">Hidden builders surfaced</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{stats.builders}</p>
            <Link href="/discover" className="mt-2 inline-block text-xs text-resolve-accent hover:underline">
              View discovery →
            </Link>
          </Panel>
          <Panel className="p-4">
            <p className="text-[10px] uppercase text-resolve-muted">Impact-weighted settled</p>
            <Money amount={stats.settled} size="md" className="mt-2" />
            <Link href="/methodology" className="mt-2 inline-block text-xs text-resolve-accent hover:underline">
              Read methodology →
            </Link>
          </Panel>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-10 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
              Not another registry clone
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              Distribution is the asset. Valuation is the hard part.
            </h2>
            <p className="mt-1 max-w-lg text-sm text-resolve-muted">
              Twenty teams will ship MusicBrainz payee lists. RESOLVE answers who gets how much —
              with visible signals, weight proofs, and Arc settlement.
            </p>
          </div>
          <Link
            href="/stack"
            className="inline-flex items-center gap-2 rounded-md border border-resolve-border-strong px-4 py-2 text-sm text-white hover:bg-resolve-hover"
          >
            Under the hood
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
