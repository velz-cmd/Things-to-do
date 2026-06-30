"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight,
  Check,
  CircleDot,
  HelpCircle,
  Sparkles,
  X,
} from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Button } from "@/components/resolve/ui/button";
import {
  ECOSYSTEM_FAQ,
  ECOSYSTEM_LOOP,
  ECOSYSTEM_ROLES,
  RFB_PROGRAMS,
  type EcosystemRoleId,
} from "@/lib/capital/ecosystem-program";

const ACCENT: Record<string, { ring: string; bg: string; text: string; dot: string }> = {
  emerald: {
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  violet: {
    ring: "ring-violet-500/30",
    bg: "bg-violet-500/10",
    text: "text-violet-300",
    dot: "bg-violet-400",
  },
  blue: {
    ring: "ring-blue-500/30",
    bg: "bg-blue-500/10",
    text: "text-blue-300",
    dot: "bg-blue-400",
  },
  orange: {
    ring: "ring-orange-500/30",
    bg: "bg-orange-500/10",
    text: "text-orange-300",
    dot: "bg-orange-400",
  },
  slate: {
    ring: "ring-white/20",
    bg: "bg-white/5",
    text: "text-resolve-muted",
    dot: "bg-white/40",
  },
};

type Props = {
  /** Compact mode for embedding in Capital / Discover */
  variant?: "full" | "compact";
  defaultRole?: EcosystemRoleId;
};

export function EcosystemBenefitsProgram({
  variant = "full",
  defaultRole = "creator",
}: Props) {
  const [activeRole, setActiveRole] = useState<EcosystemRoleId>(defaultRole);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const role = ECOSYSTEM_ROLES.find((r) => r.id === activeRole)!;
  const accent = ACCENT[role.accent] ?? ACCENT.blue;

  return (
    <section id="how-it-works" className="space-y-10 scroll-mt-24">
      {/* Header */}
      <div className={variant === "compact" ? "space-y-2" : "space-y-4"}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-resolve-accent" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
            Ecosystem program
          </p>
        </div>
        <h2
          className={clsx(
            "font-semibold text-white",
            variant === "compact" ? "text-lg" : "text-2xl md:text-3xl",
          )}
        >
          Everyone benefits — here is your path
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-resolve-muted">
          RESOLVE does not create economies from scratch. It discovers value that already exists
          upstream, records what is owed, and fulfills when capital arrives. No role is left behind.
        </p>
      </div>

      {/* Universal loop */}
      <BlueGlowCard variant="subtle" className="overflow-hidden p-0">
        <div className="border-b border-white/[0.06] px-5 py-3">
          <p className="text-xs font-medium text-white">The loop — same for every community</p>
        </div>
        <ol className="grid gap-px bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-4">
          {ECOSYSTEM_LOOP.map((step) => (
            <li key={step.step} className="bg-[#0a0f18]/80 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-resolve-accent/15 text-[11px] font-bold text-resolve-accent">
                  {step.step}
                </span>
                <p className="text-sm font-medium text-white">{step.title}</p>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-resolve-muted-dim">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      </BlueGlowCard>

      {/* Role selector */}
      <div>
        <p className="mb-3 text-xs font-medium text-resolve-muted">Who are you?</p>
        <div className="flex flex-wrap gap-2">
          {ECOSYSTEM_ROLES.map((r) => {
            const a = ACCENT[r.accent] ?? ACCENT.blue;
            const selected = activeRole === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveRole(r.id)}
                className={clsx(
                  "rounded-full border px-4 py-2 text-xs font-medium transition",
                  selected ?
                    clsx("border-transparent ring-2", a.ring, a.bg, a.text)
                  : "border-white/10 text-resolve-muted hover:border-white/20 hover:text-white",
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active role detail */}
      <BlueGlowCard className={clsx("ring-1", accent.ring)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className={clsx("text-[10px] font-semibold uppercase tracking-wider", accent.text)}>
              {role.label}
            </p>
            <h3 className="mt-1 text-xl font-semibold text-white">{role.headline}</h3>
            <p className="mt-1 text-sm text-resolve-muted">{role.tagline}</p>
          </div>
          <Link href={role.cta.href}>
            <Button size="sm" className="gap-1.5">
              {role.cta.label}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              <Check className="h-3 w-3" /> What you get
            </p>
            <ul className="space-y-2">
              {role.youGet.map((item) => (
                <li key={item} className="flex gap-2 text-[11px] leading-relaxed text-resolve-muted">
                  <CircleDot className={clsx("mt-0.5 h-3 w-3 shrink-0", accent.text)} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-300">
              <ArrowRight className="h-3 w-3" /> What you do
            </p>
            <ul className="space-y-2">
              {role.youDo.map((item) => (
                <li key={item} className="flex gap-2 text-[11px] leading-relaxed text-resolve-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-blue-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-300/90">
              <X className="h-3 w-3" /> You never have to
            </p>
            <ul className="space-y-2">
              {role.youNever.map((item) => (
                <li key={item} className="flex gap-2 text-[11px] leading-relaxed text-resolve-muted-dim">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-rose-400/60" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </BlueGlowCard>

      {variant === "full" && (
        <>
          {/* Program tracks grid */}
          <div>
            <p className="text-sm font-semibold text-white">Programs — who benefits per track</p>
            <p className="mt-1 text-xs text-resolve-muted">
              Each program attaches beside upstream tools. Every row has a winner for creators,
              funders, founders, and audience.
            </p>
            <ul className="mt-4 grid gap-3 lg:grid-cols-2">
              {RFB_PROGRAMS.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/60 p-4 transition hover:border-white/[0.12]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-violet-300">
                      {p.trackLabel}
                    </span>
                    <p className="text-sm font-medium text-white">{p.name}</p>
                  </div>
                  <p className="mt-1 text-[10px] text-resolve-muted-dim">{p.upstream}</p>
                  <dl className="mt-3 space-y-2 text-[11px]">
                    <div>
                      <dt className="text-emerald-300/90">Creators</dt>
                      <dd className="text-resolve-muted">{p.whoBenefits}</dd>
                    </div>
                    <div>
                      <dt className="text-violet-300/90">Funders</dt>
                      <dd className="text-resolve-muted">{p.funderGets}</dd>
                    </div>
                    <div>
                      <dt className="text-blue-300/90">Founders</dt>
                      <dd className="text-resolve-muted">{p.founderGets}</dd>
                    </div>
                    <div>
                      <dt className="text-resolve-muted-dim">Audience</dt>
                      <dd className="text-resolve-muted-dim">{p.audienceNote}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.communities.map((slug) => (
                      <Link
                        key={slug}
                        href={`/communities/${slug}`}
                        className="text-[10px] text-resolve-accent hover:underline"
                      >
                        {slug} →
                      </Link>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* FAQ */}
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <HelpCircle className="h-4 w-4 text-resolve-accent" />
              Common questions
            </p>
            <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#0a0f18]/40">
              {ECOSYSTEM_FAQ.map((item, i) => (
                <li key={item.q}>
                  <button
                    type="button"
                    onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                    className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
                  >
                    <span className="text-sm text-white">{item.q}</span>
                    <span className="text-resolve-muted">{faqOpen === i ? "−" : "+"}</span>
                  </button>
                  {faqOpen === i && (
                    <p className="border-t border-white/[0.04] px-4 py-3 text-xs leading-relaxed text-resolve-muted">
                      {item.a}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
