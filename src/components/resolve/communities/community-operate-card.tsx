"use client";

import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import clsx from "clsx";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Money } from "@/components/resolve/ui/money";
import type { CommunityCatalogEntry } from "@/lib/communities/catalog";
import type { CommunityHubOpsStats } from "@/lib/communities/hub-ops-stats";
import { communityConsolePath } from "@/lib/communities/community-nav";

const accentRing: Record<string, string> = {
  violet: "from-violet-500/20 to-resolve-accent/10",
  emerald: "from-emerald-500/20 to-teal-500/10",
  blue: "from-blue-500/20 to-resolve-accent/10",
  orange: "from-orange-500/20 to-amber-500/10",
};

type Props = {
  community: Pick<CommunityCatalogEntry, "slug" | "name" | "tagline" | "accent" | "kind">;
  hubOps: CommunityHubOpsStats | null;
  /** Profile-linked but not formally installed — show operate with vitals fallback */
  linkedOnly?: boolean;
  programCountFallback?: number;
  pendingFallbackUsd?: number;
  treasuryFallbackUsd?: number;
};

export function CommunityOperateCard({
  community,
  hubOps,
  linkedOnly = false,
  programCountFallback = 0,
  pendingFallbackUsd = 0,
  treasuryFallbackUsd = 0,
}: Props) {
  const programCount = hubOps?.programCount ?? programCountFallback;
  const treasuryUsd = hubOps?.treasuryUsd ?? treasuryFallbackUsd;
  const pendingUsd = hubOps?.pendingObligationsUsd ?? pendingFallbackUsd;
  const operateHref =
    pendingUsd > 0.01
      ? communityConsolePath(community.slug, "approve_payouts")
      : programCount > 0
        ? communityConsolePath(community.slug)
        : communityConsolePath(community.slug, "create_program");

  return (
    <BlueGlowCard className="relative overflow-hidden" hover>
      <div
        aria-hidden
        className={clsx(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-40",
          accentRing[community.accent] ?? accentRing.violet,
        )}
      />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl resolve-accent-gradient shadow-resolve-glow">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-emerald-300">
            {linkedOnly ? "Linked" : "Operating"}
          </span>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white">{community.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-resolve-muted">{community.tagline}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-2">
            <p className="text-[9px] uppercase tracking-wider text-resolve-muted">Treasury</p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              <Money amount={treasuryUsd} size="sm" className="inline" />
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-2">
            <p className="text-[9px] uppercase tracking-wider text-resolve-muted">Pending</p>
            <p className="mt-0.5 text-sm font-semibold text-amber-100">
              <Money amount={pendingUsd} size="sm" className="inline" />
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/25 px-2 py-2">
            <p className="text-[9px] uppercase tracking-wider text-resolve-muted">Programs</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{programCount}</p>
          </div>
        </div>

        <Link
          href={operateHref}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-resolve-accent/35 bg-resolve-accent/10 py-2.5 text-sm font-medium text-resolve-accent transition hover:bg-resolve-accent/15"
        >
          Operate
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </BlueGlowCard>
  );
}
