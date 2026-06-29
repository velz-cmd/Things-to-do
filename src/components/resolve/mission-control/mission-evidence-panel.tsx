"use client";

import { useCallback, useState } from "react";
import { LiveEventsList } from "@/components/resolve/events/live-events-list";

/** Ledger evidence shown before approve / settle in Mission. */
export function MissionEvidencePanel({
  missionId,
  visible,
  onEvidenceCount,
}: {
  missionId?: string | null;
  visible: boolean;
  onEvidenceCount?: (count: number) => void;
}) {
  const [count, setCount] = useState(0);

  const handleData = useCallback(
    (data: { events: unknown[] }) => {
      const n = data.events?.length ?? 0;
      setCount(n);
      onEvidenceCount?.(n);
    },
    [onEvidenceCount],
  );

  if (!visible) return null;

  const hasEvidence = count > 0;

  return (
    <div
      className={`mx-auto mb-4 max-w-2xl rounded-xl border px-4 py-3 ${
        hasEvidence
          ? "border-emerald-500/25 bg-emerald-500/[0.04]"
          : "border-amber-500/20 bg-amber-500/[0.04]"
      }`}
    >
      <p
        className={`mb-2 text-[10px] font-semibold uppercase tracking-wide ${
          hasEvidence ? "text-emerald-200/90" : "text-amber-200/80"
        }`}
      >
        {hasEvidence
          ? `Ledger evidence — ${count} row(s) ready for review`
          : "Ledger evidence required before Execute"}
      </p>
      {!hasEvidence && (
        <p className="mb-2 text-[11px] text-resolve-muted">
          Run community sensors or wait for upstream activity. Settlement is blocked until
          authorizations appear here.
        </p>
      )}
      <LiveEventsList
        mission={missionId ?? undefined}
        limit={8}
        pollMs={15_000}
        compact
        title="Evidence"
        subtitle=""
        onData={handleData}
        emptyMessage={
          missionId
            ? "No ledger rows for this mission yet. Run sensors or wait for community activity."
            : "Start a program-backed mission to see authorization evidence here."
        }
      />
    </div>
  );
}
