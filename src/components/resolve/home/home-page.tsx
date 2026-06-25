"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Scale, Search, Landmark } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";

const LOOP = [
  { step: "01", verb: "Discover", icon: Search, href: "/discover" },
  { step: "02", verb: "Weight", icon: Scale, href: "/weight" },
  { step: "03", verb: "Settle", icon: Landmark, href: "/weight" },
];

const OTHERS = [
  "MusicBrainz payee registry",
  "Mastodon tipping widget",
  "CSV batch payout",
  "Open-source donation page",
];

const RESOLVE = [
  "Live GitHub unpaid-value scan",
  "Impact Score (7 signals)",
  "Proportional split + proof hash",
  "Challenge weight before settle",
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
          <p className="text-sm font-medium text-resolve-accent">Lepton · Unpaid Value Index</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
            Everyone pays contributors.
            <span className="block text-blue-300">We find who deserves how much.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-resolve-muted">
            Twenty teams read the same Canteen post and ship registries. RESOLVE scans real OSS
            graphs, scores impact, lets you challenge the split, settles on Arc.
          </p>
          <Link
            href="/discover"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-resolve-accent px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Open Unpaid Value Index
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-8 lg:px-8">
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
          <Panel className="border-red-500/20 p-4">
            <p className="text-[10px] font-medium uppercase text-red-300/90">What judges see ×20</p>
            <ul className="mt-3 space-y-2 text-sm text-resolve-muted">
              {OTHERS.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </Panel>
          <Panel className="border-emerald-500/20 p-4">
            <p className="text-[10px] font-medium uppercase text-emerald-300/90">RESOLVE</p>
            <ul className="mt-3 space-y-2 text-sm text-white">
              {RESOLVE.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </Panel>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-3 md:grid-cols-3">
            {LOOP.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.step} href={item.href} className="group">
                  <Panel className="p-4 text-center transition hover:border-resolve-accent/40">
                    <Icon className="mx-auto h-6 w-6 text-resolve-accent" />
                    <p className="mt-2 text-lg font-semibold text-white">{item.verb}</p>
                    <p className="text-[10px] text-resolve-muted">{item.step}</p>
                  </Panel>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-8 lg:px-8">
        <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-3">
          <Panel className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.live}</p>
            <p className="text-[10px] uppercase text-resolve-muted">Live GitHub scans</p>
          </Panel>
          <Panel className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.builders}</p>
            <p className="text-[10px] uppercase text-resolve-muted">Indexed builders</p>
          </Panel>
          <Panel className="p-4 text-center">
            <Money amount={stats.settled} size="md" className="justify-center" />
            <p className="mt-1 text-[10px] uppercase text-resolve-muted">Impact-weighted settled</p>
          </Panel>
        </div>
      </section>
    </div>
  );
}
