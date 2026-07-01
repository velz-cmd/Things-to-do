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
  variant = "default",
}: {
  id?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  hidden?: boolean;
  variant?: "default" | "compact" | "featured";
}) {
  if (hidden) return null;

  return (
    <section
      id={id}
      className={clsx(
        "discover-premium-section scroll-mt-24 overflow-hidden rounded-[1.25rem] border border-resolve-border/50 bg-resolve-surface/30 shadow-resolve backdrop-blur-md",
        variant === "featured" && "discover-premium-section--featured",
        variant === "compact" && "discover-premium-section--compact",
        "resolve-card-hover",
        className,
      )}
    >
      <div
        className={clsx(
          "discover-premium-section__header relative flex flex-wrap items-center justify-between gap-3 border-b border-resolve-border/40 bg-gradient-to-r from-white/[0.04] via-resolve-accent/[0.06] to-white/[0.02]",
          variant === "compact" ? "px-3.5 py-2.5 sm:px-4" : "px-4 py-3.5 sm:px-5",
        )}
      >
        <div className="min-w-0">
          <h2
            className={clsx(
              "font-semibold tracking-tight text-white",
              variant === "compact" ? "text-[13px] sm:text-sm" : "text-sm sm:text-base",
            )}
          >
            {title}
          </h2>
          {subtitle && (
            <div
              className={clsx(
                "mt-0.5 leading-relaxed text-resolve-muted",
                variant === "compact" ? "text-[10px]" : "mt-1 text-[11px]",
              )}
            >
              {subtitle}
            </div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      <div
        className={clsx(
          "relative",
          variant === "compact" ? "px-3.5 py-3 sm:px-4" : "px-4 py-4 sm:px-5 sm:py-5",
        )}
      >
        {children}
      </div>
    </section>
  );
}
