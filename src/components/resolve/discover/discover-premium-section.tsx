"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

/** Discover section shell — premium gradient + silver headline strip (always open). */
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
        "resolve-signal-service-card resolve-card-hover scroll-mt-24 overflow-hidden rounded-2xl",
        className,
      )}
    >
      <div className="resolve-silver-strip resolve-silver-strip--headline flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-white sm:text-base">{title}</h2>
          {subtitle && (
            <div className="mt-1 text-[11px] leading-relaxed text-white/60">{subtitle}</div>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="resolve-signal-card-body relative z-[1] px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}
