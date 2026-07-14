"use client";

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";

export type WorkflowChip = {
  label: string;
  href?: string;
  active?: boolean;
};

const accentGlow = {
  blue: "from-resolve-accent-bright/20 via-transparent to-blue-500/10",
  orange: "from-resolve-orange/20 via-transparent to-orange-500/10",
  emerald: "from-emerald-500/15 via-transparent to-resolve-accent/10",
};

export function ProductPage({
  icon: Icon,
  title,
  description,
  workflows,
  actions,
  children,
  width = "wide",
  accent = "blue",
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  workflows?: WorkflowChip[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: "narrow" | "wide" | "full";
  accent?: "blue" | "orange" | "emerald";
}) {
  const maxWidth =
    width === "narrow" ? "max-w-3xl" : width === "full" ? "max-w-[1400px]" : "max-w-6xl";

  return (
    <div className={clsx("resolve-page relative mx-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-10", maxWidth)}>
      <header className="relative mb-8 animate-resolve-enter lg:mb-10">
        <div
          aria-hidden
          className={clsx(
            "pointer-events-none absolute -inset-x-8 -top-8 h-36 rounded-full opacity-30 blur-3xl",
            "bg-gradient-to-b",
            accentGlow[accent],
          )}
        />

        <BlueGlowCard className="overflow-hidden p-0" padding={false} grid={false}>
          <div
            className={clsx(
              "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-60",
              accentGlow[accent],
            )}
          />
          <div className="resolve-spotlight relative flex flex-wrap items-start justify-between gap-6 p-6 md:p-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {Icon && (
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl resolve-accent-gradient shadow-[0_8px_24px_rgba(59,157,255,.22)]">
                    <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
                  </div>
                )}
                <h1 className="text-3xl font-semibold tracking-tight text-white md:text-[2rem]">
                  {title}
                </h1>
              </div>
              <p className="max-w-2xl text-[15px] leading-relaxed text-resolve-muted">
                {description}
              </p>
              {workflows && workflows.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {workflows.map((w) =>
                    w.href ?
                      <a
                        key={w.label}
                        href={w.href}
                        className={clsx(
                          "rounded-full px-3.5 py-1.5 text-[11px] font-medium transition-all duration-300",
                          w.active ?
                            "bg-resolve-accent/15 text-white ring-1 ring-resolve-accent/30"
                          : "bg-white/[0.04] text-resolve-muted ring-1 ring-resolve-border hover:bg-resolve-accent/10 hover:text-white",
                        )}
                      >
                        {w.label}
                      </a>
                    : <span
                        key={w.label}
                        className={clsx(
                          "rounded-full px-3.5 py-1.5 text-[11px] font-medium ring-1",
                          w.active ?
                            "bg-resolve-accent/15 text-white ring-resolve-accent/30"
                          : "bg-white/[0.03] text-resolve-muted-dim ring-resolve-border",
                        )}
                      >
                        {w.label}
                      </span>,
                  )}
                </div>
              )}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        </BlueGlowCard>
      </header>

      <div className="animate-resolve-enter">{children}</div>
    </div>
  );
}
