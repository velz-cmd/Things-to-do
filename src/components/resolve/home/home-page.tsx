"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Scale, Search, Landmark, GitBranch } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";

const LOOP = [
  { step: "01", verb: "Discover", icon: Search, href: "/discover", sub: "Unpaid Value Index" },
  { step: "02", verb: "Weight", icon: Scale, href: "/weight", sub: "Proof-of-Weight" },
  { step: "03", verb: "Settle", icon: Landmark, href: "/weight", sub: "Proportional split on Arc" },
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
            Open Impact Settlement Protocol
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
            Value is everywhere.
            <span className="block text-blue-300">Valuation isn&apos;t.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-resolve-muted">
            Open source. Any contribution graph. RESOLVE discovers who is unpaid, weights heterogeneous
            impact with published proofs, and settles proportional splits on Arc — code, music,
            streams, photos, posts in one protocol.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 rounded-md bg-resolve-accent px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Unpaid Value Index
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/protocol"
              className="inline-flex items-center gap-2 rounded-md border border-resolve-border-strong px-5 py-3 text-sm text-white hover:bg-resolve-hover"
            >
              <GitBranch className="h-4 w-4" />
              Protocol spec
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-center text-[10px] font-medium uppercase tracking-wider text-resolve-muted">
            One protocol · any graph
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
            <h2 className="text-base font-semibold text-white">Why a protocol — not another app</h2>
            <ul className="mt-3 space-y-2 text-sm text-resolve-muted">
              <li>· <span className="text-white">Multi-party splits</span> — not binary winner-take-all markets</li>
              <li>· <span className="text-white">Heterogeneous events</span> — one engine for merges, scrobbles, streams, EXIF, citations</li>
              <li>· <span className="text-white">Discovery first</span> — payees don&apos;t need to be known upfront</li>
              <li>· <span className="text-white">Published weight proofs</span> — hash + open signals, not operator black boxes</li>
              <li>· <span className="text-white">Permissionless disputes</span> — stake to challenge a share before settlement</li>
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
