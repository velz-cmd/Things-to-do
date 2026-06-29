"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Button } from "@/components/resolve/ui/button";
import { Money } from "@/components/resolve/ui/money";
import { CAPITAL_YIELD_COPY } from "@/lib/capital/copy";
import type { FundableOpportunity } from "@/lib/capital/community-yield";

export function FunderDiscoveryPanel({ signedIn }: { signedIn: boolean }) {
  const [opportunities, setOpportunities] = useState<FundableOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [fundingId, setFundingId] = useState<string | null>(null);
  const [amountByProgram, setAmountByProgram] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/capital/discover");
      const data = await res.json();
      setOpportunities(data.opportunities ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function fund(programId: string) {
    const raw = amountByProgram[programId] ?? "25";
    const amountUsd = Number(raw);
    if (!Number.isFinite(amountUsd) || amountUsd < 5) {
      toast.error("Enter at least $5");
      return;
    }
    setFundingId(programId);
    try {
      const res = await fetch("/api/capital/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ programId, amountUsd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fund failed");
      toast.success(`Funded $${amountUsd.toFixed(2)} — clearing obligations toward 2× leverage`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not fund program");
    } finally {
      setFundingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-resolve-accent" />
          <h2 className="text-sm font-semibold text-white">{CAPITAL_YIELD_COPY.discover.title}</h2>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-resolve-muted">
          {CAPITAL_YIELD_COPY.discover.subtitle}
        </p>
      </div>

      <BlueGlowCard variant="subtle" className="text-xs leading-relaxed text-resolve-muted">
        <p className="font-medium text-white">{CAPITAL_YIELD_COPY.yieldExplainer.title}</p>
        <p className="mt-1">{CAPITAL_YIELD_COPY.yieldExplainer.body}</p>
      </BlueGlowCard>

      {loading ?
        <div className="flex items-center gap-2 text-sm text-resolve-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading programs…
        </div>
      : !opportunities.length ?
        <p className="text-sm text-resolve-muted">
          No active programs yet.{" "}
          <Link href="/discover" className="text-resolve-accent hover:underline">
            Browse communities
          </Link>{" "}
          to install the first one.
        </p>
      : <ul className="space-y-3">
          {opportunities.map((o) => (
            <li
              key={o.programId}
              className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/60 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-white">{o.programName}</p>
                    <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-violet-300">
                      {o.templateLabel}
                    </span>
                    {o.yieldMultiplier >= o.targetMultiplier && (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-300">
                        {CAPITAL_YIELD_COPY.discover.targetBadge}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-resolve-muted">
                    {o.communityName} — {o.communityTagline}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-resolve-muted-dim">{o.whyFund}</p>
                  <p className="mt-1 text-[11px] text-resolve-muted">{o.whoBenefits}</p>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <p className="text-[10px] uppercase text-resolve-muted-dim">
                    {o.metricKind === "match_leverage" ?
                      CAPITAL_YIELD_COPY.discover.qfLabel
                    : CAPITAL_YIELD_COPY.discover.fulfillmentLabel}
                  </p>
                  <p className="text-lg font-semibold tabular-nums text-emerald-300">
                    {o.yieldMultiplier > 0 ? `${o.yieldMultiplier.toFixed(2)}×` : "—"}
                  </p>
                  <p className="mt-1 text-resolve-muted">
                    <Money amount={o.impactValueUsd} size="sm" className="inline" /> impact
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3">
                {signedIn ?
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-resolve-muted">$</span>
                      <input
                        type="number"
                        min={5}
                        step={5}
                        value={amountByProgram[o.programId] ?? "25"}
                        onChange={(e) =>
                          setAmountByProgram((prev) => ({
                            ...prev,
                            [o.programId]: e.target.value,
                          }))
                        }
                        className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-white"
                      />
                    </div>
                    <Button
                      size="sm"
                      disabled={fundingId === o.programId}
                      onClick={() => void fund(o.programId)}
                    >
                      {fundingId === o.programId ?
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : o.templateId === "quadratic-funding" ?
                        CAPITAL_YIELD_COPY.discover.fundCta
                      : CAPITAL_YIELD_COPY.discover.fundFulfillCta}
                    </Button>
                  </>
                : <p className="text-[11px] text-resolve-muted">Sign in to fund programs</p>}
                <Link
                  href={`/communities/${o.communitySlug}`}
                  className="inline-flex items-center gap-1 text-[11px] text-resolve-accent hover:underline"
                >
                  {CAPITAL_YIELD_COPY.discover.viewCta}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      }
    </section>
  );
}
