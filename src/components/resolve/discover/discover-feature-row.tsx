"use client";

import type { DiscoverIntent, TrendingValueGap } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import type { DiscoverCardLane } from "@/lib/discover/types";
import { ValueReceiptCard } from "@/components/resolve/discover/value-receipt-card";

type DiscoverFeatureRowProps = {
  gap: TrendingValueGap;
  signedIn: boolean;
  intent?: DiscoverIntent;
  role?: DiscoverRole;
  rank?: number;
  surface?: string;
  lane?: DiscoverCardLane;
};

/** Unpaid Value row — Phase A value receipt card with 3 actions. */
export function DiscoverFeatureRow({
  gap,
  signedIn,
  intent = "all",
  role = "all",
  rank,
  surface = "feature-row",
  lane = "gaps",
}: DiscoverFeatureRowProps) {
  return (
    <li>
      <ValueReceiptCard
        source={{ kind: "gap", gap }}
        signedIn={signedIn}
        intent={intent}
        role={role}
        rank={rank}
        surface={surface}
        lane={lane}
      />
    </li>
  );
}
