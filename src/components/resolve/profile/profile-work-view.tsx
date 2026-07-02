import clsx from "clsx";
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

  const connected = streams.filter((s) => s.connected);
  if (!connected.length) return null;

  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-300/90">
          Your connected work
        </p>
        <p className="mt-1 text-xs text-resolve-muted">
          Verified activity from your linked sources — claim payouts on Capital.
        </p>
        {degraded && (
          <p className="mt-1 text-[10px] text-amber-200/90">Ledger sync delayed — showing connection status.</p>
        )}
      </div>

      <ul className="space-y-2">
        {connected.map((stream) => (
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
              <span
                className={clsx(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  stream.meetsEligibility
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-white/10 bg-white/[0.03] text-resolve-muted",
                )}
              >
                {stream.meetsEligibility ? "Eligible" : "Building"}
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
