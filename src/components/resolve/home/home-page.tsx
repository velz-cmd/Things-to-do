"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/resolve/ui/button";
import { ValueFlowAnimation } from "@/components/resolve/home/value-flow-animation";

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
  const router = useRouter();

  return (
    <div className="relative">
      {/* §1 Hero — animation + one sentence */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 md:grid-cols-2 md:items-center md:pt-24">
        <div>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white md:text-5xl">
            The internet already knows who created the value.
            <span className="mt-3 block text-resolve-muted">
              It just doesn&apos;t know how to pay them.
            </span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-resolve-muted">
            Value already exists. RESOLVE discovers it, proves it, and moves capital where it
            belongs — across code, music, research, and every open ecosystem.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="glow" size="lg" onClick={() => router.push("/workspace")}>
              Open workspace
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="lg" onClick={() => router.push("/activity")}>
              Watch value flow
            </Button>
          </div>
        </div>
        <ValueFlowAnimation />
      </section>

      {/* §2 Problems vs RESOLVE */}
      <section className="border-y border-resolve-border bg-resolve-bg-deep/40 py-20">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-300/80">
              Without settlement infrastructure
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

      {/* §3 Industries — not connectors */}
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

      {/* §4 CTA */}
      <section className="border-t border-resolve-border py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <p className="text-lg font-medium text-white">
            Capital infrastructure for open ecosystems.
          </p>
          <p className="mt-2 text-sm text-resolve-muted">
            Observe · Reason · Move capital. RESOLVE disappears behind the work.
          </p>
          <Button variant="glow" className="mt-8" size="lg" onClick={() => router.push("/workspace")}>
            Enter workspace
          </Button>
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
