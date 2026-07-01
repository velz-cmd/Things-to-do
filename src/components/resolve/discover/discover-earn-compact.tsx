"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { Money } from "@/components/resolve/ui/money";
import type { ProfileEarningsSummary } from "@/lib/earn/summary";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";

type EarnPayload = {
  signedIn: boolean;
  earnings?: ProfileEarningsSummary;
  claimUrl?: string | null;
};

/** Capital-style medium strip — full earn console lives on /capital */
export function DiscoverEarnCompact({ signedIn }: { signedIn: boolean }) {
  const [data, setData] = useState<EarnPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    return fetch("/api/earn/discover", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body: EarnPayload) => setData(body))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load, signedIn]);

  const earnings = data?.earnings;
  const claimable = earnings?.claimableUsd ?? 0;
  const earned = earnings?.youEarnedUsd ?? 0;

  return (
    <DiscoverCapitalCard
      id="earn"
      accent="emerald"
      className="discover-earn-strip scroll-mt-24"
      padding={false}
    >
      <div className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-resolve-muted-dim">
            How much have I earned?
          </p>
          {loading ? (
            <p className="mt-1 flex items-center gap-2 text-xs text-resolve-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading ledger…
            </p>
          ) : !data?.signedIn ? (
            <p className="mt-1 text-xs text-resolve-muted">
              Sign in on Capital to see verified earnings and claim on Arc.
            </p>
          ) : (
            <p className="mt-1 text-lg font-semibold text-white">
              {earned > 0 || claimable > 0 ? (
                <>
                  <Money amount={earned} size="md" className="text-emerald-300" />
                  {claimable > 0 && (
                    <span className="ml-2 text-xs font-normal text-emerald-200/90">
                      · <Money amount={claimable} size="sm" className="inline" /> claimable
                    </span>
                  )}
                </>
              ) : (
                <span className="text-sm text-resolve-muted">$0 verified — earnings appear as value is recognized on Arc</span>
              )}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {claimable > 0 && (
            <Link
              href={data?.claimUrl ?? "/claim"}
              className="discover-action-btn discover-action-btn--primary discover-action-btn--fund"
            >
              Claim
            </Link>
          )}
          <Link
            href="/capital"
            className="discover-action-btn discover-action-btn--primary discover-action-btn--install inline-flex items-center gap-1"
          >
            Open on Capital
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
      </div>
    </DiscoverCapitalCard>
  );
}
