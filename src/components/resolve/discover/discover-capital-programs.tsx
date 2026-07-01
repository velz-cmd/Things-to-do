"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Layers, RefreshCw } from "lucide-react";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { Panel } from "@/components/resolve/ui/panel";
import { Money } from "@/components/resolve/ui/money";

type RepaymentResult = {
  creatorsPaidUsd: number;
  funderRepaidUsd: number;
  funderRemainingCapUsd: number;
  communitySurplusUsd: number;
  capReached: boolean;
};

export function DiscoverCapitalPrograms({ className }: { className?: string }) {
  const [repayment, setRepayment] = useState<RepaymentResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/economy/repayment/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          principalUsd: 1000,
          immediateCreatorPayoutUsd: 850,
          futureInflowsUsd: [200, 350, 500, 120, 800],
        }),
      });
      const data = (await res.json()) as { ok: boolean; result?: RepaymentResult };
      if (data.ok && data.result) setRepayment(data.result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DiscoverPremiumSection
      id="capital-programs"
      title="Capital programs"
      subtitle="Repayment waterfall, operator attach, and on-chain deploy — real Arc settlement, not ledger-only labels"
      className={className}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="border-violet-500/20 bg-violet-500/5 p-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-violet-300" />
            <p className="text-xs font-medium text-white">Repayment waterfall (live simulate)</p>
          </div>
          {loading && !repayment ? (
            <p className="mt-3 text-sm text-resolve-muted">Running waterfall on sample inflows…</p>
          ) : repayment ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-resolve-muted-dim">Creators paid now</dt>
                <dd className="mt-1">
                  <Money amount={repayment.creatorsPaidUsd} size="sm" className="text-emerald-300" />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-resolve-muted-dim">Funders repaid</dt>
                <dd className="mt-1">
                  <Money amount={repayment.funderRepaidUsd} size="sm" />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-resolve-muted-dim">Remaining cap</dt>
                <dd className="mt-1">
                  <Money amount={repayment.funderRemainingCapUsd} size="sm" />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-resolve-muted-dim">Community surplus</dt>
                <dd className="mt-1">
                  <Money amount={repayment.communitySurplusUsd} size="sm" className="text-sky-300" />
                </dd>
              </div>
            </dl>
          ) : null}
          <p className="mt-3 text-[11px] text-resolve-muted-dim">
            Capped payback from future OC, sponsors, API revenue —{" "}
            <code className="text-violet-300">POST /api/economy/repayment/simulate</code>
          </p>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-300" />
              <p className="text-xs font-medium text-white">Operator attach</p>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-resolve-muted">
              Install sensors beside Navidrome, GitHub, OpenAlex. Strangers fund; you operate payouts.
              Operator SaaS billing is next — programs and settlement are live today.
            </p>
            <Link
              href="/communities"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-resolve-accent hover:underline"
            >
              Install a community
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/api/economy/operator/attach"
              className="mt-2 block text-[10px] text-resolve-muted-dim hover:text-resolve-muted"
            >
              Operator pricing manifest
            </Link>
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-sky-300" />
              <p className="text-xs font-medium text-white">On-chain deploy</p>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-resolve-muted">
              Program deploy batches USDC on Arc with platform fee split. Mission escrow vault (ERC-8183) is
              separate from ledger <code className="text-resolve-muted">escrow:…</code> refs.
            </p>
            <Link
              href="/capital#treasury"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-resolve-accent hover:underline"
            >
              Treasury & deploy
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              href="/api/communities/react/export"
              className="mt-2 block text-[10px] text-resolve-muted-dim hover:text-resolve-muted"
            >
              B2B export sample (react)
            </Link>
          </Panel>
        </div>
      </div>
    </DiscoverPremiumSection>
  );
}
