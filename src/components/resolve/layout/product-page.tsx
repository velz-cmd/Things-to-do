"use client";

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export type WorkflowChip = {
  label: string;
  href?: string;
  active?: boolean;
};

export function ProductPage({
  icon: Icon,
  title,
  description,
  workflows,
  actions,
  children,
  width = "wide",
  accent,
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

  const glow =
    accent === "violet" ? "from-violet-500/10"
    : accent === "emerald" ? "from-emerald-500/10"
    : accent === "amber" ? "from-amber-500/10"
    : "from-resolve-accent/10";

  return (
    <div className={clsx("mx-auto px-4 py-8 lg:px-6 animate-resolve-enter", maxWidth)}>
      <header className="relative mb-10 overflow-hidden rounded-resolve-lg border border-resolve-border/60 resolve-glass resolve-card-glow">
        <div
          aria-hidden
          className={clsx(
            "pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent",
            glow,
          )}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4 p-6 md:p-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="flex h-10 w-10 items-center justify-center rounded-resolve-lg border border-resolve-border-strong bg-resolve-raised/80 shadow-resolve">
                  <Icon className="h-5 w-5 text-resolve-accent" strokeWidth={1.5} />
                </div>
              )}
              <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h1>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-resolve-muted md:text-[15px]">
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
                        "rounded-full border px-3 py-1 text-[11px] font-medium transition",
                        w.active ?
                          "border-white/25 bg-white/10 text-white"
                        : "border-resolve-border/60 text-resolve-muted hover:border-white/15 hover:text-white",
                      )}
                    >
                      {w.label}
                    </a>
                  : <span
                      key={w.label}
                      className={clsx(
                        "rounded-full border px-3 py-1 text-[11px] font-medium",
                        w.active ?
                          "border-white/25 bg-white/10 text-white"
                        : "border-resolve-border/40 text-resolve-muted-dim",
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
      </header>
      {children}
    </div>
  );
}
