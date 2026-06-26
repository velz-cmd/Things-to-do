"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Sparkles,
  GitBranch,
  Wallet,
  Activity,
  Shield,
  Zap,
} from "lucide-react";
import { parseRepoInput } from "@/lib/workspace/parse-repo";
import { toast } from "sonner";
import { Button } from "@/components/resolve/ui/button";
import { Input } from "@/components/resolve/ui/input";
import { Panel } from "@/components/resolve/ui/panel";
import { MetricCard } from "@/components/resolve/ui/metric-card";
import { Money } from "@/components/resolve/ui/money";
import { HeroOrb } from "@/components/resolve/home/hero-orb";

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI-native reasoning",
    body: "Ask where value is. Get evidence-backed answers. Nothing executes without your approval.",
  },
  {
    icon: GitBranch,
    title: "Open ecosystem attribution",
    body: "GitHub, music, research — one protocol layer for recognizing contribution across domains.",
  },
  {
    icon: Wallet,
    title: "Real settlement",
    body: "Treasury, Arc batches, claims, and FX — Stripe-grade money movement for open work.",
  },
  {
    icon: Shield,
    title: "Authorization first",
    body: "Every dollar is authorized with proof before it moves. Audit trail from evidence to settlement.",
  },
] as const;

export function HomePage() {
  const router = useRouter();
  const [repoInput, setRepoInput] = useState("");

  function handleAnalyze() {
    const parsed = parseRepoInput(repoInput);
    if (!parsed) {
      toast.error("Enter owner/repo or a GitHub URL");
      return;
    }
    router.push(`/workspace/fund?owner=${parsed.owner}&repo=${parsed.repo}`);
  }

  return (
    <div className="relative overflow-hidden">
      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-12 md:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <HeroOrb />

          <p className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-4 py-1.5 text-[11px] font-medium text-cyan-200/90 ring-1 ring-cyan-400/20 backdrop-blur-sm">
            <Zap className="h-3 w-3 text-cyan-400" />
            Capital flow protocol for open ecosystems
          </p>

          <h1 className="mt-8 text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
            <span className="resolve-text-gradient">The operating system</span>
            <span className="mt-2 block text-white/95">for open value.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-resolve-muted">
            Discover where value exists. Authorize fairly. Route capital. Settle globally — from
            maintainers to musicians, researchers, and moderators.
          </p>

          <div className="mx-auto mt-10 max-w-md">
            <Panel variant="glow" className="p-2" padding={false}>
              <div className="p-2">
                <Input
                  inputSize="lg"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder="owner/repository — fund a project"
                  className="border-0 bg-transparent focus:ring-0"
                />
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Button variant="glow" size="lg" className="flex-1" onClick={handleAnalyze}>
                    Fund contributors
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    onClick={() => router.push("/workspace")}
                  >
                    Open workspace
                  </Button>
                </div>
              </div>
            </Panel>
            <p className="mt-4 text-xs text-resolve-muted-dim">
              Connect once. Value streams automatically across code, music, and research.
            </p>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="relative mx-auto mt-20 max-w-4xl">
          <div
            aria-hidden
            className="absolute -inset-8 rounded-[2rem] bg-gradient-to-b from-cyan-500/20 via-indigo-500/10 to-transparent blur-3xl"
          />
          <Panel variant="glow" className="relative overflow-hidden p-0" padding={false} hover>
            <div className="border-b border-white/[0.06] px-6 py-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium tracking-wide text-resolve-muted">
                  Mission control
                </p>
                <span className="flex items-center gap-2 text-[10px] font-medium text-emerald-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Live
                </span>
              </div>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-3">
              <MetricCard
                label="Recognized"
                value={<Money amount={6750} size="sm" />}
                hint="Across open ecosystems"
                icon={Activity}
                tone="accent"
              />
              <MetricCard
                label="Claimable"
                value={<Money amount={2540} size="sm" />}
                hint="12 participants"
                icon={Wallet}
                tone="success"
                live
              />
              <MetricCard
                label="Settled"
                value={<Money amount={5318} size="sm" />}
                hint="Arc batches"
                icon={Shield}
                tone="violet"
              />
            </div>
            <div className="border-t border-white/[0.06] bg-black/20 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-resolve-muted">
                  <span className="font-medium text-white">AI analyst ready</span> — ask where
                  value is leaking
                </p>
                <Link
                  href="/workspace"
                  className="text-xs font-semibold text-cyan-300 transition hover:text-cyan-200"
                >
                  Enter workspace →
                </Link>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 border-t border-white/[0.04] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Not a dashboard.
              <span className="mt-1 block text-resolve-muted">An operating system.</span>
            </h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Panel key={f.title} variant="glass" hover className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl resolve-accent-gradient shadow-resolve-glow">
                  <f.icon className="h-4 w-4 text-white" strokeWidth={1.5} />
                </div>
                <h3 className="mt-5 text-sm font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-resolve-muted">{f.body}</p>
              </Panel>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 pb-24">
        <div className="mx-auto max-w-6xl px-6">
          <Panel variant="accent" className="overflow-hidden p-8 md:p-12">
            <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  Every workflow. One protocol.
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-resolve-muted">
                  Workspace for intelligence. Activity for live value. Payments for treasury.
                  Profile for identity.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="glow" onClick={() => router.push("/workspace")}>
                  Open workspace
                </Button>
                <Button variant="secondary" onClick={() => router.push("/activity")}>
                  View activity
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.04] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-resolve-muted-dim">
          <p>RESOLVE — capital flow for open ecosystems</p>
          <div className="flex gap-6">
            <Link href="/terms" className="transition hover:text-white">
              Terms
            </Link>
            <Link href="/privacy" className="transition hover:text-white">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
