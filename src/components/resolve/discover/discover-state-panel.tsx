"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

type DiscoverStatePanelProps = {
  children: ReactNode;
  variant?: "empty" | "error" | "loading";
  className?: string;
};

/** Calm Discover surfaces — empty/error states match Phase 0 palette. */
export function DiscoverStatePanel({
  children,
  variant = "empty",
  className,
}: DiscoverStatePanelProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border px-5 py-8 text-center",
        variant === "error" &&
          "border-resolve-calm-alert/25 bg-resolve-calm-alert/[0.06]",
        variant === "empty" &&
          "border-resolve-calm-periwinkle/20 bg-resolve-calm-card/[0.06]",
        variant === "loading" &&
          "border-resolve-calm-periwinkle/15 bg-resolve-bg-deep/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DiscoverRetryButton({
  onClick,
  label = "Retry",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 text-xs font-medium text-resolve-calm-blue hover:text-resolve-accent"
    >
      {label}
    </button>
  );
}

/** Shown when partial radar data loaded — avoids blocking the whole section. */
export function DiscoverDegradedHint({
  onRefresh,
  className,
}: {
  onRefresh?: () => void;
  className?: string;
}) {
  return (
    <p className={clsx("text-[11px] text-resolve-calm-periwinkle/90", className)}>
      Some sources were slow — showing what we have.
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="ml-1 font-medium text-resolve-calm-blue hover:text-resolve-accent"
        >
          Refresh
        </button>
      )}
    </p>
  );
}
