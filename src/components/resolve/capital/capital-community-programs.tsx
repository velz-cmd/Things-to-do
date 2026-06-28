"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Radio } from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Money } from "@/components/resolve/ui/money";

type CapitalProgram = {
  id: string;
  name: string;
  communitySlug: string;
  status: string;
  budgetUsd: number;
  missionId: string | null;
  measure: {
    authorizedUsd: number;
    settledUsd: number;
    playCount: number;
    settlementRate: number;
  } | null;
};

/** Capital page — programs drive execution, not orphan treasury */
export function CapitalCommunityPrograms() {
  const [programs, setPrograms] = useState<CapitalProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/capital/programs", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { programs: [] }))
      .then((d: { programs?: CapitalProgram[] }) => setPrograms(d.programs ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-resolve-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading community programs…
      </div>
    );
  }

  if (!programs.length) {
    return (
      <BlueGlowCard variant="subtle" className="text-sm text-resolve-muted">
        <p>No programs yet — install RESOLVE on a community from Discover.</p>
        <Link href="/discover" className="mt-2 inline-flex items-center gap-1 text-resolve-accent hover:underline">
          Community directory
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </BlueGlowCard>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="h-4 w-4 text-resolve-accent" />
        <h2 className="text-sm font-semibold text-white">Community programs</h2>
      </div>
      <p className="text-xs text-resolve-muted">Capital executes through programs — not orphan transfers</p>
      <ul className="space-y-2">
        {programs.map((p) => (
          <li key={p.id}>
            <Link
              href={`/communities/${p.communitySlug}`}
              className="block rounded-xl border border-white/[0.08] bg-[#0a0f18]/60 px-4 py-3 transition hover:border-resolve-accent/30"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-[11px] text-resolve-muted">{p.communitySlug} · {p.status}</p>
                </div>
                <div className="text-right text-xs">
                  <Money amount={p.measure?.authorizedUsd ?? 0} size="sm" className="text-emerald-300" />
                  <p className="text-resolve-muted-dim">
                    budget <Money amount={p.budgetUsd} size="sm" className="inline" />
                  </p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
