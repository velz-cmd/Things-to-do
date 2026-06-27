"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Sparkles,
  GitBranch,
  Wallet,
  Shield,
  Zap,
  ChevronDown,
} from "lucide-react";
import { parseRepoInput } from "@/lib/workspace/parse-repo";
import { toast } from "sonner";
import { Button } from "@/components/resolve/ui/button";
import { Input } from "@/components/resolve/ui/input";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { MetricCard } from "@/components/resolve/ui/metric-card";
import { Money } from "@/components/resolve/ui/money";
import { HeroConstellation } from "@/components/resolve/home/hero-constellation";

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
      {/* Agex-style hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-8 pt-16 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-resolve-accent/20 bg-resolve-accent/10 px-4 py-1.5 text-[11px] font-medium text-blue-200/90 backdrop-blur-sm">
            <Zap className="h-3 w-3 text-resolve-accent-bright" />
            Capital flow protocol for open ecosystems
          </p>

          <h1 className="mt-8 text-4xl font-semibold leading-[1.06] tracking-tight md:text-[3.5rem]">
            <span className="resolve-text-gradient">The future of open value</span>
            <span className="mt-2 block text-white/95">starts with RESOLVE.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-resolve-muted">
            Discover where value exists. Authorize fairly. Route capital. Settle globally — from
            maintainers to musicians, researchers, and moderators.
          </p>

          {/* Agex-style pill input */}
          <div className="mx-auto mt-10 max-w-lg">
            <BlueGlowCard className="p-2" grid={false}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  inputSize="lg"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  placeholder="owner/repository — fund a project"
                  className="flex-1 border-0 bg-transparent focus:ring-0"
                />
                <Button variant="glow" size="lg" onClick={handleAnalyze} className="shrink-0">
                  Fund contributors
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </BlueGlowCard>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Button variant="secondary" size="sm" onClick={() => router.push("/workspace")}>
                Open workspace
              </Button>
              <Button variant="ghost" size="sm" onClick={() => router.push("/activity")}>
                See live activity
              </Button>
            </div>
          </div>
        </div>

        {/* Boltshift constellation */}
        <HeroConstellation />
      </section>

      {/* Mission control preview — conversion-rate card style */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-8">
        <div className="relative">
          <div
            aria-hidden
            className="absolute -inset-6 rounded-[2rem] opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(ellipse at 50% 100%, rgba(0,122,255,0.25) 0%, transparent 70%)",
            }}
          />
          <BlueGlowCard className="relative overflow-hidden p-0" padding={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-resolve-border px-6 py-4">
              <p className="text-xs font-medium tracking-wide text-resolve-muted">
                Data updated 2h ago
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full border border-resolve-border bg-resolve-raised/50 px-3 py-1 text-[10px] font-medium text-resolve-muted"
              >
                Monthly
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-3">
              <MetricCard
                label="Recognized"
                value={<Money amount={6750} size="sm" />}
                hint="Across open ecosystems"
                tone="accent"
              />
              <MetricCard
                label="Claimable"
                value={<Money amount={2540} size="sm" />}
                hint="12 participants"
                tone="success"
                live
              />
              <MetricCard
                label="Settled"
                value={<Money amount={5318} size="sm" />}
                hint="Arc batches"
                tone="blue"
              />
            </div>
            <div className="border-t border-resolve-border bg-resolve-bg-deep/40 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-resolve-muted">
                  <span className="font-medium text-white">AI analyst ready</span> — ask where value
                  is leaking
                </p>
                <Link
                  href="/workspace"
                  className="text-xs font-semibold text-resolve-accent-bright transition hover:text-white"
                >
                  Enter workspace →
                </Link>
              </div>
            </div>
          </BlueGlowCard>
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 border-t border-resolve-border py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Not a dashboard.
              <span className="mt-1 block text-resolve-muted">An operating system.</span>
            </h2>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <BlueGlowCard key={f.title} className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl resolve-accent-gradient shadow-resolve-glow">
                  <f.icon className="h-4 w-4 text-white" strokeWidth={1.5} />
                </div>
                <h3 className="mt-5 text-sm font-semibold text-white">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-resolve-muted">{f.body}</p>
              </BlueGlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 pb-24">
        <div className="mx-auto max-w-6xl px-6">
          <BlueGlowCard
            className="overflow-hidden border border-resolve-accent/20 p-8 md:p-12"
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-40"
              style={{
                background:
                  "radial-gradient(ellipse at 30% 50%, rgba(0,122,255,0.2) 0%, transparent 60%)",
              }}
            />
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
                <Button variant="secondary" onClick={() => router.push("/payments")}>
                  View payments
                </Button>
              </div>
            </div>
          </BlueGlowCard>
        </div>
      </section>

      <footer className="relative z-10 border-t border-resolve-border py-8">
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
