"use client";

import Link from "next/link";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/resolve/ui/button";
import { ValueFlowAnimation } from "@/components/resolve/home/value-flow-animation";
import { HomePrimaryCta } from "@/components/resolve/home/home-primary-cta";

const WITHOUT = [
  "Libraries power million-dollar products — maintainers earn $0",
  "Documentation teaches thousands — writers earn nothing",
  "Moderators run communities — no sustainable funding",
  "Streaming pools royalties — not listener-direct payouts",
  "AI cites research — authors never paid for reuse",
  "Founders spend weeks on spreadsheets — no evidence trail",
] as const;

const WITH = [
  "Detects contribution where work already happens",
  "Attributes value across the full graph",
  "Recommends capital with evidence and confidence",
  "Batches settlement globally on Arc",
  "Settles in USDC — sub-cent per participant",
] as const;

const INDUSTRIES = [
  { name: "Code", leak: "Dependencies uncredited", fix: "Maintainer recognition from usage" },
  { name: "Music", leak: "Platform pools hide listeners", fix: "User-centric per-play settlement" },
  { name: "Research", leak: "Citations without payment", fix: "Attribution → authorization" },
  { name: "Publishing", leak: "Republishing is free", fix: "Usage-based micropayments" },
  { name: "Communities", leak: "Mods work unpaid", fix: "Policy-driven capital flows" },
] as const;

export function HomePage() {
  return (
    <div className="relative">
      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 md:grid-cols-2 md:items-center md:pt-24">
        <div>
          <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight text-white md:text-5xl">
            RESOLVE tells you where money should go across the open internet — and moves it
            there once you approve.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-resolve-muted">
            The largest economy in the world is open — code, music, research, communities — but
            nobody can see it as one system. RESOLVE observes, understands, recommends, and
            executes when you&apos;re ready.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <HomePrimaryCta />
          </div>
        </div>
        <ValueFlowAnimation />
      </section>

      <section className="border-y border-resolve-border bg-resolve-bg-deep/40 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300/80">
              Today&apos;s internet
            </p>
            <ul className="mt-6 space-y-4">
              {WITHOUT.map((line) => (
                <li key={line} className="flex gap-3 text-sm text-resolve-muted">
                  <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-400/80" strokeWidth={2} />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
              With RESOLVE
            </p>
            <ul className="mt-6 space-y-4">
              {WITH.map((line) => (
                <li key={line} className="flex gap-3 text-sm text-white/90">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2} />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-muted">
          One engine · every industry
        </p>
        <h2 className="mt-3 text-center text-2xl font-semibold text-white">
          Where value leaks — and how it gets routed back
        </h2>
        <div className="mt-12 divide-y divide-resolve-border/60 border-y border-resolve-border/60">
          {INDUSTRIES.map((row) => (
            <div
              key={row.name}
              className="grid gap-4 py-5 md:grid-cols-[120px_1fr_1fr] md:items-center md:gap-8"
            >
              <p className="text-sm font-semibold text-white">{row.name}</p>
              <p className="text-sm text-rose-200/70">{row.leak}</p>
              <p className="text-sm text-resolve-accent-bright/90">{row.fix}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-resolve-border py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <p className="text-lg font-medium text-white">
            Economic intelligence for the open internet.
          </p>
          <p className="mt-2 text-sm text-resolve-muted">
            Ask a question. Get evidence. Approve when you&apos;re ready.
          </p>
          <HomePrimaryCta />
        </div>
      </section>

      <footer className="border-t border-resolve-border py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-resolve-muted-dim">
          <p>RESOLVE</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
