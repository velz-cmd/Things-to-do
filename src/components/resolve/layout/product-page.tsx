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
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  workflows?: WorkflowChip[];
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: "narrow" | "wide" | "full";
}) {
  const maxWidth =
    width === "narrow" ? "max-w-3xl" : width === "full" ? "max-w-[1400px]" : "max-w-6xl";

  return (
    <div className={clsx("mx-auto px-4 py-8 lg:px-6", maxWidth)}>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            {Icon && <Icon className="h-5 w-5 text-resolve-accent" strokeWidth={1.5} />}
            <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">{title}</h1>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-resolve-muted">{description}</p>
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
                        "border-white/20 bg-white/10 text-white"
                      : "border-resolve-border/60 text-resolve-muted hover:border-resolve-border hover:text-white",
                    )}
                  >
                    {w.label}
                  </a>
                : <span
                    key={w.label}
                    className="rounded-full border border-resolve-border/40 px-3 py-1 text-[11px] text-resolve-muted-dim"
                  >
                    {w.label}
                  </span>,
              )}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
