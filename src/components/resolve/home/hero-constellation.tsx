"use client";

import { Activity, CheckCircle2, GitBranch, Sparkles, Wallet } from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { HeroOrb } from "@/components/resolve/home/hero-orb";

const ORBIT_CARDS = [
  {
    icon: Sparkles,
    title: "AI reasoning",
    stat: "400%",
    statLabel: "faster discovery",
    position: "top-left",
  },
  {
    icon: GitBranch,
    title: "Attribution",
    stat: "12",
    statLabel: "connectors live",
    position: "top-right",
  },
  {
    icon: Wallet,
    title: "Settlement",
    stat: "$5.3k",
    statLabel: "settled this month",
    position: "bottom-left",
  },
  {
    icon: Activity,
    title: "Live value",
    stat: "24/7",
    statLabel: "activity stream",
    position: "bottom-right",
  },
] as const;

function OrbitCard({
  icon: Icon,
  title,
  stat,
  statLabel,
  className,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  stat: string;
  statLabel: string;
  className?: string;
}) {
  return (
    <BlueGlowCard className={className} padding={false}>
      <div className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-resolve-accent/15 ring-1 ring-resolve-accent/25">
            <Icon className="h-3.5 w-3.5 text-resolve-accent-bright" strokeWidth={1.5} />
          </div>
          <p className="text-[11px] font-semibold text-white">{title}</p>
        </div>
        <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-white">
          {stat}
          <span className="ml-1 inline-flex text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </span>
        </p>
        <p className="mt-0.5 text-[10px] text-resolve-muted-dim">{statLabel}</p>
      </div>
    </BlueGlowCard>
  );
}

/** Boltshift-style orb with four connected glass cards */
export function HeroConstellation() {
  return (
    <div className="relative mx-auto mt-16 w-full max-w-4xl px-4">
      {/* Connection lines — desktop only */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
        viewBox="0 0 800 480"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(59,158,255,0)" />
            <stop offset="50%" stopColor="rgba(0,122,255,0.6)" />
            <stop offset="100%" stopColor="rgba(59,158,255,0)" />
          </linearGradient>
        </defs>
        {[
          "M 400 240 L 120 80",
          "M 400 240 L 680 80",
          "M 400 240 L 120 400",
          "M 400 240 L 680 400",
        ].map((d) => (
          <path
            key={d}
            d={d}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="1.5"
            className="animate-resolve-pulse-line"
            style={{ transformOrigin: "400px 240px" }}
          />
        ))}
        {[
          [120, 80],
          [680, 80],
          [120, 400],
          [680, 400],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="4" fill="rgba(0,122,255,0.8)">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2.5s" repeatCount="indefinite" />
          </circle>
        ))}
      </svg>

      <div className="relative grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_auto_1fr] md:grid-rows-[auto_auto_auto] md:gap-x-8 md:gap-y-10">
        <OrbitCard
          {...ORBIT_CARDS[0]}
          className="md:col-start-1 md:row-start-1 md:justify-self-end md:w-[200px]"
        />
        <OrbitCard
          {...ORBIT_CARDS[1]}
          className="md:col-start-3 md:row-start-1 md:justify-self-start md:w-[200px]"
        />

        <div className="relative z-10 flex justify-center md:col-start-2 md:row-span-3 md:row-start-1 md:self-center">
          <HeroOrb size="lg" />
        </div>

        <OrbitCard
          {...ORBIT_CARDS[2]}
          className="md:col-start-1 md:row-start-3 md:justify-self-end md:w-[200px]"
        />
        <OrbitCard
          {...ORBIT_CARDS[3]}
          className="md:col-start-3 md:row-start-3 md:justify-self-start md:w-[200px]"
        />
      </div>
    </div>
  );
}
