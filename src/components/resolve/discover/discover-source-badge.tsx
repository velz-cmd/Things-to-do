"use client";

import clsx from "clsx";
import type { DiscoverDataSource } from "@/lib/discover/types";
import { SOURCE_BADGE_LABELS, SOURCE_BADGE_STYLES, isPreviewSource } from "@/lib/discover/source-badges";

export function DiscoverSourceBadge({
  source,
  estimate = false,
  className,
}: {
  source: DiscoverDataSource;
  estimate?: boolean;
  className?: string;
}) {
  const preview = isPreviewSource(source);
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
        SOURCE_BADGE_STYLES[source],
        className,
      )}
      title={
        estimate
          ? "Estimated from GitHub repo health — not ledger-verified"
          : preview
            ? "Preview data — not verified from live source"
            : SOURCE_BADGE_LABELS[source]
      }
    >
      {SOURCE_BADGE_LABELS[source]}
      {estimate ? " · est." : preview ? " · demo" : ""}
    </span>
  );
}
