"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Money } from "@/components/resolve/ui/money";
import { formatDecayUrgencyLabel } from "@/lib/earn/summary";

type EarningsResponse = {
  signedIn: boolean;
  youEarnedUsd: number;
  claimableUsd: number;
  settledUsd: number;
  stalestClaimableAt: string | null;
  notifyUrgency: number;
  githubLinked: boolean;
  identities: { label: string; claimableUsd: number; settledUsd: number }[];
};

export function ProfileEarningsSummary() {
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile/earnings", { credentials: "include" })
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setData(body);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-resolve-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading earnings…
      </div>
    );
  }

  if (!data?.signedIn) {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
        <p className="text-sm text-resolve-muted">
          Sign in to see verified earnings from connected communities.
        </p>
      </div>
    );
  }

  const urgencyLabel = formatDecayUrgencyLabel(data.stalestClaimableAt);
  const hasEarnings = data.youEarnedUsd > 0 || data.claimableUsd > 0;

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
        {data.claimableUsd > 0 && (
          <p className="mt-2 text-sm text-resolve-muted">
            <Money amount={data.claimableUsd} size="sm" className="inline text-white" /> ready to
            claim
            {data.settledUsd > 0 && (
              <>
                {" "}
                · <Money amount={data.settledUsd} size="sm" className="inline" /> already settled
              </>
            )}
          </p>
        )}
        {urgencyLabel && data.claimableUsd > 0 && (
          <p className="mt-1 text-xs text-amber-200/90">{urgencyLabel}</p>
        )}
      </div>

      {data.identities.some((i) => i.claimableUsd > 0 || i.settledUsd > 0) && (
        <ul className="space-y-2 rounded-xl border border-white/[0.06] bg-[#0a0f18] p-4">
          {data.identities
            .filter((i) => i.claimableUsd > 0 || i.settledUsd > 0)
            .map((identity) => (
              <li
                key={identity.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="text-resolve-muted">{identity.label}</span>
                <span className="text-white">
                  {identity.claimableUsd > 0 ? (
                    <>
                      <Money amount={identity.claimableUsd} size="sm" className="inline" /> claimable
                    </>
                  ) : (
                    <>
                      <Money amount={identity.settledUsd} size="sm" className="inline" /> settled
                    </>
                  )}
                </span>
              </li>
            ))}
        </ul>
      )}

      {data.claimableUsd > 0 && (
        <Link
          href="/claim"
          className="inline-flex items-center justify-center gap-2 rounded-resolve-lg border border-resolve-accent/30 bg-gradient-to-r from-resolve-accent to-blue-500 px-7 py-3.5 text-sm font-semibold text-white shadow-resolve-glow transition-all hover:scale-[1.03]"
        >
          Claim <Money amount={data.claimableUsd} size="sm" className="inline" />
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      {!data.githubLinked && data.claimableUsd <= 0 && (
        <p className="text-xs text-resolve-muted-dim">
          Connect GitHub in settings to match ledger authorizations to your account.
        </p>
      )}
    </section>
  );
}
