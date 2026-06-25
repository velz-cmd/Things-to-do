"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Scale, Search, Landmark, GitBranch } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";

const LOOP = [
  { step: "01", verb: "Radar", icon: Search, href: "/radar", sub: "Unfunded OSS opportunities" },
  { step: "02", verb: "Weight", icon: Scale, href: "/weight", sub: "Sybil Shield + Weight Council" },
  { step: "03", verb: "Settle", icon: Landmark, href: "/weight", sub: "Evidence-based Arc split" },
];

export function HomePage() {
  const [stats, setStats] = useState({ settled: 0, builders: 0, live: 0 });

  useEffect(() => {
    void Promise.all([
      fetch("/api/treasury").then((r) => r.json()),
      fetch("/api/discover/builders").then((r) => r.json()),
    ])
      .then(([treasury, discovery]) =>
        setStats({
          settled: treasury.totalDistributedUsd ?? 0,
          builders: discovery.discovered ?? 0,
          live: discovery.liveScanned ?? 0,
        }),
      )
      .catch(() => {});
  }, []);

  return (
    <div className="resolve-grid-bg min-h-screen pb-16">
      <section className="relative overflow-hidden px-4 pb-10 pt-10 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]" />
        <div className="relative mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium text-resolve-accent">
            Capital Flow Protocol · Phase 1: GitHub
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
            Money is easy.
            <span className="block text-blue-300">Knowing where it should go is hard.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-resolve-muted">
            RESOLVE discovers who created the most value in a repository, explains why with
            evidence, resists sybil attacks, and distributes capital transparently on Arc.
            Starting with GitHub — every PR, review, and diff is public and verifiable.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/radar"
              className="inline-flex items-center gap-2 rounded-md bg-resolve-accent px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              GitHub Radar
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/blueprint"
              className="inline-flex items-center gap-2 rounded-md border border-resolve-border-strong px-5 py-3 text-sm text-white hover:bg-resolve-hover"
            >
              <GitBranch className="h-4 w-4" />
              System blueprint
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-center text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
            GitHub first · protocol scales to every community
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {LOOP.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.step} href={item.href} className="group">
                  <Panel className="p-4 text-center transition hover:border-resolve-accent/40">
                    <Icon className="mx-auto h-6 w-6 text-resolve-accent" />
                    <p className="mt-2 text-lg font-semibold text-white">{item.verb}</p>
                    <p className="text-[10px] text-resolve-muted">{item.sub}</p>
                  </Panel>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Panel className="p-5">
            <h2 className="text-base font-semibold text-white">What judges should see</h2>
            <ul className="mt-3 space-y-2 text-sm text-resolve-muted">
              <li>· <span className="text-white">Value discovery</span> — high-star repos with maintainer stress and $0 funding</li>
              <li>· <span className="text-white">Sybil-resistant attribution</span> — trust scores before weighting, not commit counts</li>
              <li>· <span className="text-white">Founder intent</span> — infra 50%, docs 20% — AI scores within your priorities</li>
              <li>· <span className="text-white">Transparent evidence</span> — every payout links to PRs, reviews, and reasoning</li>
              <li>· <span className="text-white">Arc settlement</span> — proportional USDC split with on-chain proof hash</li>
            </ul>
          </Panel>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-8 lg:px-8">
        <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-3">
          <Panel className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.live}</p>
            <p className="text-[10px] uppercase text-resolve-muted">Live graph scans</p>
          </Panel>
          <Panel className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.builders}</p>
            <p className="text-[10px] uppercase text-resolve-muted">Indexed in UVI</p>
          </Panel>
          <Panel className="p-4 text-center">
            <Money amount={stats.settled} size="md" className="justify-center" />
            <p className="mt-1 text-[10px] uppercase text-resolve-muted">Settled on Arc</p>
          </Panel>
        </div>
      </section>
    </div>
  );
}
