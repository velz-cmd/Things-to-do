import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Money } from "@/components/resolve/ui/money";
import { formatDecayUrgencyLabel } from "@/lib/earn/format";
import type { ProfileEarningsSummary } from "@/lib/earn/summary";

function identityKindLabel(payeeKeyType: string): string {
  if (payeeKeyType === "github_username") return "GitHub";
  if (payeeKeyType === "wallet") return "Wallet";
  if (payeeKeyType.startsWith("listen_")) return "Music";
  return "Identity";
}

function identityKindDescription(payeeKeyType: string): string {
  if (payeeKeyType === "github_username") return "Open-source contributions";
  if (payeeKeyType === "wallet") return "On-chain payee key";
  if (payeeKeyType.startsWith("listen_")) return "Plays & credits via MusicBrainz";
  return "Linked payee";
}

export function ProfileEarningsView({
  data,
  signedIn,
}: {
  data: ProfileEarningsSummary | null;
  signedIn: boolean;
}) {
  if (!signedIn) {
    return (
      <section className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400/90">
          Your earnings
        </p>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
          <p className="text-sm text-resolve-muted">
            Sign in to see verified earnings from your communities.
          </p>
          <Link href="/login?next=/profile" className="mt-3 inline-block text-sm font-medium text-resolve-accent hover:underline">
            Sign in →
          </Link>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="space-y-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400/90">
          Your earnings
        </p>
        <p className="text-sm text-resolve-muted">Earnings unavailable — retry shortly.</p>
      </section>
    );
  }

  const urgencyLabel = formatDecayUrgencyLabel(data.stalestClaimableAt);
  const hasEarnings =
    data.youEarnedUsd > 0 || data.claimableUsd > 0 || data.authorizedUsd > 0;
  const activeIdentities = data.identities.filter(
    (i) => i.claimableUsd > 0 || i.authorizedUsd > 0 || i.settledUsd > 0,
  );

  return (
    <section className="space-y-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-400/90">
          Your earnings
        </p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          {hasEarnings ? (
            <>
              You earned{" "}
              <Money amount={data.youEarnedUsd} size="lg" className="inline text-emerald-300" />
            </>
          ) : (
            "No verified earnings yet"
          )}
        </h2>
        {!hasEarnings && (
          <p className="mt-2 text-sm text-resolve-muted">
            Enable sources below — RESOLVE credits earnings automatically after recognized activity.
          </p>
        )}
        {(data.claimableUsd > 0 || data.authorizedUsd > 0) && (
          <p className="mt-2 text-sm text-resolve-muted">
            {data.claimableUsd > 0 && (
              <>
                <Money amount={data.claimableUsd} size="sm" className="inline text-white" /> ready to
                claim
              </>
            )}
            {data.authorizedUsd > 0 && (
              <>
                {data.claimableUsd > 0 ? " · " : ""}
                <Money amount={data.authorizedUsd} size="sm" className="inline" /> recognized, pending
                funding
              </>
            )}
          </p>
        )}
        {urgencyLabel && data.claimableUsd > 0 && (
          <p className="mt-1 text-xs text-amber-200/90">{urgencyLabel}</p>
        )}
      </div>

      {data.identities.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-[#0a0f18] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
            By identity
          </p>
          <ul className="mt-3 space-y-3">
            {data.identities.map((identity) => (
              <li
                key={`${identity.payeeKeyType}:${identity.label}`}
                className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{identity.label}</p>
                    <p className="text-[10px] text-resolve-muted">
                      {identityKindLabel(identity.payeeKeyType)} ·{" "}
                      {identityKindDescription(identity.payeeKeyType)}
                    </p>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    {identity.claimableUsd > 0 && (
                      <p className="text-emerald-300">
                        <Money amount={identity.claimableUsd} size="sm" className="inline" /> claimable
                      </p>
                    )}
                    {identity.authorizedUsd > 0 && (
                      <p className="text-amber-200/90">
                        <Money amount={identity.authorizedUsd} size="sm" className="inline" /> pending
                      </p>
                    )}
                    {!identity.claimableUsd && !identity.authorizedUsd && !identity.settledUsd && (
                      <p className="text-resolve-muted-dim">No activity</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {activeIdentities.length > 0 && data.claimableUsd > 0 && (
        <Link
          href="/claim"
          className="inline-flex items-center justify-center gap-2 rounded-resolve-lg border border-resolve-accent/30 bg-gradient-to-r from-resolve-accent to-blue-500 px-7 py-3.5 text-sm font-semibold text-white shadow-resolve-glow transition-all hover:scale-[1.03]"
        >
          Claim <Money amount={data.claimableUsd} size="sm" className="inline" />
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </section>
  );
}
