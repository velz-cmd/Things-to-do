"use client";

import { LiveEventsList } from "@/components/resolve/events/live-events-list";

/** Ledger evidence shown before approve / settle in Mission. */
export function MissionEvidencePanel({
  missionId,
  visible,
}: {
  missionId?: string | null;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="mx-auto mb-4 max-w-2xl rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
        Ledger evidence — review before approving
      </p>
      <LiveEventsList
        mission={missionId ?? undefined}
        limit={8}
        pollMs={15_000}
        compact
        title="Evidence"
        subtitle=""
        emptyMessage={
          missionId
            ? "No ledger rows for this mission yet. Run sensors or wait for community activity."
            : "Start a program-backed mission to see authorization evidence here."
        }
      />
    </div>
  );
}
