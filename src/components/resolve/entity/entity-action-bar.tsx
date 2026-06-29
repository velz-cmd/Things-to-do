"use client";

import Link from "next/link";
import { ArrowRight, CircleDollarSign, Download } from "lucide-react";
import { Button } from "@/components/resolve/ui/button";
import type { EntitySurface } from "@/lib/entity/types";
import { suggestedCommunitySlugForEntity } from "@/lib/entity/paths";

function suggestedCommunity(surface: EntitySurface): string | null {
  return suggestedCommunitySlugForEntity(surface.kind, surface.communitySlug);
}

export function EntityActionBar({ surface }: { surface: EntitySurface }) {
  const community = suggestedCommunity(surface);
  const hasEarnings = surface.valueCreated.totalUsd > 0 || surface.payments.length > 0;
  const hasGap = surface.fundingGap.gapUsd > 0.01;

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-resolve-accent/20 bg-resolve-accent/[0.04] px-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-white">One click from here</p>
        <p className="mt-0.5 text-xs text-resolve-muted">
          {hasGap
            ? `$${surface.fundingGap.gapUsd.toFixed(2)} unpriced — install sensors or fulfill obligations`
            : hasEarnings
              ? "Value recognized in the ledger — claim or fund the next batch"
              : "Install a community program to start recognizing value upstream"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {community && (
          <Link href={`/communities/${community}`}>
            <Button size="sm" variant="secondary" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Install program
            </Button>
          </Link>
        )}
        <Link href={hasEarnings ? "/profile" : "/capital?tab=programs"}>
          <Button size="sm" className="gap-1.5">
            <CircleDollarSign className="h-3.5 w-3.5" />
            {hasEarnings ? "Your earnings" : "Fulfill obligations"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
