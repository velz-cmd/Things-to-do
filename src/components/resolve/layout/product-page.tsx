"use client";

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export type WorkflowChip = {
  label: string;
  href?: string;
  active?: boolean;
};

const accentGlow = {
  blue: "from-cyan-500/20 via-transparent to-indigo-500/10",
  violet: "from-violet-500/20 via-transparent to-indigo-500/10",
  emerald: "from-emerald-500/15 via-transparent to-cyan-500/10",
  amber: "from-amber-500/15 via-transparent to-orange-500/10",
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
  accent?: "blue" | "violet" | "emerald" | "amber";
}) {
  const maxWidth =
    width === "narrow" ? "max-w-3xl" : width === "full" ? "max-w-[1400px]" : "max-w-6xl";

  return (
    <div className={clsx("relative mx-auto px-4 py-10 lg:px-8", maxWidth)}>
      <header className="relative mb-12 animate-resolve-enter">
        {/* Ambient glow behind header */}
        <div
          aria-hidden
          className={clsx(
            "pointer-events-none absolute -inset-x-8 -top-8 h-48 rounded-full opacity-60 blur-3xl",
            "bg-gradient-to-b",
            accentGlow[accent],
          )}
        />

        <div className="relative overflow-hidden rounded-resolve-xl resolve-border-gradient resolve-glass resolve-card-glow-accent">
          <div
            className={clsx(
              "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
              accentGlow[accent],
            )}
          />
          <div className="relative flex flex-wrap items-start justify-between gap-6 p-7 md:p-9">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {Icon && (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl resolve-accent-gradient shadow-resolve-glow">
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
                            "bg-white/10 text-white ring-1 ring-white/20"
                          : "bg-white/[0.04] text-resolve-muted ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-white",
                        )}
                      >
                        {w.label}
                      </a>
                    : <span
                        key={w.label}
                        className={clsx(
                          "rounded-full px-3.5 py-1.5 text-[11px] font-medium ring-1",
                          w.active ?
                            "bg-white/10 text-white ring-white/20"
                          : "bg-white/[0.03] text-resolve-muted-dim ring-white/[0.05]",
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
        </div>
      </header>

      <div className="animate-resolve-enter">{children}</div>
    </div>
  );
}
