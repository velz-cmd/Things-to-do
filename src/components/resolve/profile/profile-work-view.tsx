"use client";

import type { UserWorkStream } from "@/lib/earn/user-eligible-work";

export function ProfileWorkView({
  signedIn,
  streams,
  degraded,
}: {
  signedIn: boolean;
  streams: UserWorkStream[];
  degraded?: boolean;
}) {
  if (!signedIn) return null;

  const eligible = streams.filter((s) => s.meetsEligibility);
  if (!eligible.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-300/90">
          Eligible work
        </p>
        <p className="mt-1 text-xs text-resolve-muted">
          Only verified activity that meets published thresholds appears here — batched into Discover pools of 10.
        </p>
        {degraded && (
          <p className="mt-1 text-[10px] text-amber-200/90">Ledger sync delayed — thresholds may update after sync.</p>
        )}
      </div>

      <ul className="space-y-2">
        {eligible.map((stream) => (
          <li
            key={stream.id}
            className="rounded-xl border border-white/[0.06] bg-[#0a0f18] px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-white">
                  {stream.label}
                  {stream.displayValue ? (
                    <span className="ml-2 text-xs font-normal text-resolve-muted">
                      {stream.displayValue}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[10px] text-resolve-muted-dim">{stream.activityLabel}</p>
                <p className="mt-1 text-[10px] text-resolve-muted">{stream.threshold}</p>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                Eligible
              </span>
            </div>

            {stream.recentItems.length > 0 && (
              <ul className="mt-2 space-y-1 border-t border-white/[0.05] pt-2">
                {stream.recentItems.map((item, i) => (
                  <li key={`${stream.id}-${i}`} className="text-[10px] text-resolve-muted">
                    {item.label}
                    {item.amountUsd != null && item.amountUsd > 0 && (
                      <span className="ml-1 text-amber-200/80">
                        ·{" "}
                        {item.status === "claimable" || item.status === "settled"
                          ? "Claimable"
                          : "Authorized"}{" "}
                        ${item.amountUsd.toFixed(2)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
