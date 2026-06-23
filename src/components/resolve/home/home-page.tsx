"use client";

import Link from "next/link";
import {
  ArrowRight,
  Plane,
  CreditCard,
  Package,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { problemStats, outcomeCategories } from "@/data/problem-stats";
import { HeroVisual } from "@/components/resolve/home/hero-visual";
import { LiveMissionPreview } from "@/components/resolve/home/live-mission-preview";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";

const ICONS = {
  plane: Plane,
  "credit-card": CreditCard,
  package: Package,
  shield: Shield,
};

const FLOW = [
  { step: "1", title: "Assign", desc: "Tell RESOLVE what outcome you need" },
  { step: "2", title: "Gather", desc: "Connect Gmail or add missing details" },
  { step: "3", title: "Act", desc: "Browser, email, and API tools execute" },
  { step: "4", title: "Verify", desc: "Proof is captured and checked" },
  { step: "5", title: "Settle", desc: "Payment unlocks only after proof" },
];

export function HomePage() {
  return (
    <div className="resolve-grid-bg min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-12 lg:px-8 lg:pb-28 lg:pt-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(56,189,248,0.12),transparent)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-sky-400">
              AI assistants give advice. RESOLVE completes outcomes.
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-[3.25rem]">
              Stop chasing refunds.
              <br />
              <span className="text-sky-300">Assign the outcome.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-resolve-muted">
              RESOLVE finds evidence, submits claims, retries when blocked, verifies
              proof, and unlocks proof-based payment only when the outcome is real.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/start"
                className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_30px_-5px_rgba(56,189,248,0.5)] transition hover:bg-sky-400"
              >
                Assign a task
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/missions"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/10"
              >
                See live missions
              </Link>
            </div>
          </div>
          <HeroVisual />
        </div>
      </section>

      {/* Problem stats */}
      <section className="border-t border-white/[0.06] px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-semibold text-white">
            Systems are designed to make action hard.
          </h2>
          <p className="mt-2 max-w-2xl text-resolve-muted">
            RESOLVE is built to fight that friction — with evidence, not promises.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {problemStats.map((stat) => (
              <GlassPanel key={stat.label} className="p-5">
                <p className="text-2xl font-semibold text-white">{stat.value}</p>
                <p className="mt-1 text-sm font-medium text-sky-300">{stat.label}</p>
                <p className="mt-2 text-xs leading-relaxed text-resolve-muted">
                  {stat.description}
                </p>
                <a
                  href={stat.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-[10px] text-sky-400/80 underline hover:text-sky-300"
                >
                  {stat.sourceName} · {stat.year}
                </a>
              </GlassPanel>
            ))}
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="border-t border-white/[0.06] px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-semibold text-white">What RESOLVE handles</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {outcomeCategories.map((cat) => {
              const Icon = ICONS[cat.icon];
              return (
                <GlassPanel key={cat.id} className="flex flex-col p-5">
                  <Icon className="h-5 w-5 text-sky-400" />
                  <h3 className="mt-3 font-semibold text-white">{cat.title}</h3>
                  <p className="mt-1 flex-1 text-sm text-resolve-muted">
                    {cat.description}
                  </p>
                  <Link
                    href={`/start?task=${encodeURIComponent(cat.prompt)}`}
                    className="mt-4 text-sm font-medium text-sky-400 hover:text-sky-300"
                  >
                    Start this →
                  </Link>
                </GlassPanel>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/[0.06] px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-semibold text-white">How it works</h2>
          <div className="mt-8 flex flex-wrap gap-4">
            {FLOW.map((item, i) => (
              <div key={item.step} className="flex items-center gap-3">
                <GlassPanel className="flex min-w-[140px] flex-col p-4">
                  <span className="text-xs font-medium text-sky-400">{item.step}</span>
                  <span className="mt-1 font-semibold text-white">{item.title}</span>
                  <span className="mt-1 text-xs text-resolve-muted">{item.desc}</span>
                </GlassPanel>
                {i < FLOW.length - 1 && (
                  <ArrowRight className="hidden h-4 w-4 text-resolve-muted sm:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live mission preview */}
      <section className="border-t border-white/[0.06] px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-semibold text-white">Live mission preview</h2>
          <p className="mt-2 text-resolve-muted">
            Real progress, real proof, proof-based payment only when verified.
          </p>
          <div className="mt-8">
            <LiveMissionPreview />
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-white/[0.06] px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold text-white">No proof, no payout.</h2>
          <ul className="mt-8 space-y-3 text-left text-sm text-resolve-muted">
            {[
              "Screenshots and PDFs become verifiable proof objects",
              "Emails and receipts are checked against policy",
              "Payment links only appear after backend verification",
              "Risky actions require your explicit approval",
              "RESOLVE agent identity registered on Arc (ERC-8004)",
              "Execution costs batch via Circle Gateway on settlement",
            ].map((line) => (
              <li key={line} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {line}
              </li>
            ))}
          </ul>
          <Link
            href="/start"
            className="mt-10 inline-flex items-center gap-2 rounded-full bg-sky-500 px-8 py-3.5 text-sm font-semibold text-white hover:bg-sky-400"
          >
            Give RESOLVE one task
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
