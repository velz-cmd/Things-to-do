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
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden resolve-grid-bg">
      <div aria-hidden className="pointer-events-none absolute inset-0 resolve-hero-glow" />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-resolve-accent/30 bg-resolve-accent/10 px-3 py-1 text-[11px] font-medium text-sky-200">
            <Zap className="h-3 w-3" />
            Capital flow protocol for open ecosystems
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-white md:text-6xl">
            The operating system
            <span className="mt-1 block bg-gradient-to-r from-sky-300 via-white to-violet-300 bg-clip-text text-transparent">
              for open value.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-resolve-muted">
            Discover where value exists. Authorize fairly. Route capital. Settle globally — from
            maintainers to musicians, researchers, and moderators.
          </p>

          <div className="mx-auto mt-10 max-w-lg">
            <Panel variant="glow" className="p-2">
              <Input
                inputSize="lg"
                value={repoInput}
                onChange={(e) => setRepoInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                placeholder="owner/repository — fund a project"
                className="border-0 bg-transparent focus:ring-0"
              />
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Button size="lg" className="flex-1" onClick={handleAnalyze}>
                  Fund contributors
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => router.push("/workspace")}
                >
                  Open workspace
                </Button>
              </div>
            </Panel>
            <p className="mt-4 text-xs text-resolve-muted-dim">
              Connect once. Value streams automatically across code, music, and research.
            </p>
          </div>
        </div>

        {/* Dashboard preview */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div
            aria-hidden
            className="absolute -inset-4 rounded-3xl bg-gradient-to-b from-resolve-accent/20 via-transparent to-transparent blur-2xl"
          />
          <Panel variant="glass" className="relative overflow-hidden p-0">
            <div className="border-b border-resolve-border/60 px-5 py-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-resolve-muted">Mission control preview</p>
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-resolve-pulse-glow" />
                  Live
                </span>
              </div>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3">
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
            <div className="border-t border-resolve-border/60 bg-resolve-bg/40 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-resolve-muted">
                  <span className="text-white">AI analyst ready</span> — ask where value is leaking
                </p>
                <Link
                  href="/workspace"
                  className="text-xs font-medium text-resolve-accent hover:underline"
                >
                  Enter workspace →
                </Link>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 border-t border-resolve-border/60 bg-resolve-bg/50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-white md:text-3xl">
              Not a dashboard. An operating system.
            </h2>
            <p className="mt-3 text-sm text-resolve-muted">
              Calm, premium, intelligent — built for builders who fund open ecosystems every day.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Panel key={f.title} variant="glass" className="p-5 transition hover:border-resolve-accent/20">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-resolve-border bg-resolve-raised/80">
                  <f.icon className="h-4 w-4 text-resolve-accent" strokeWidth={1.5} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-resolve-muted">{f.body}</p>
              </Panel>
            ))}
          </div>
        </div>
      </section>

      {/* Workflows CTA */}
      <section className="relative z-10 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Panel variant="accent" className="p-8 md:p-12">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div>
                <h2 className="text-xl font-semibold text-white md:text-2xl">
                  Every workflow. One protocol.
                </h2>
                <p className="mt-2 max-w-lg text-sm text-resolve-muted">
                  Workspace for intelligence. Activity for live value. Payments for treasury.
                  Profile for identity.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => router.push("/workspace")}>Open workspace</Button>
                <Button variant="secondary" onClick={() => router.push("/activity")}>
                  View activity
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <footer className="relative z-10 border-t border-resolve-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-resolve-muted-dim">
          <p>RESOLVE — capital flow for open ecosystems</p>
          <div className="flex gap-4">
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
