"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

/** Discover section shell — glass card with accent headline strip. */
export function DiscoverPremiumSection({
  id,
  title,
  subtitle,
  actions,
  children,
  className,
  hidden,
}: {
  id?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  hidden?: boolean;
}) {
  if (hidden) return null;

  return (
    <section
      id={id}
      className={clsx(
        "scroll-mt-24 overflow-hidden rounded-[1.25rem] border border-resolve-border/50 bg-resolve-surface/30 shadow-resolve backdrop-blur-md",
        "resolve-card-hover",
        className,
      )}
    >
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-resolve-border/40 bg-gradient-to-r from-white/[0.04] via-resolve-accent/[0.06] to-white/[0.02] px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-white sm:text-base">{title}</h2>
          {subtitle && (
            <div className="mt-1 text-[11px] leading-relaxed text-resolve-muted">{subtitle}</div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="relative px-4 py-4 sm:px-5 sm:py-5">{children}</div>
    </section>
  );
}
