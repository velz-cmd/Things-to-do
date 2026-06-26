import type { FundingOpportunity } from "@/lib/github/types";

export type OpportunityCard = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeTone: "high" | "claimable" | "medium";
  statA: { label: string; value: string };
  statB: { label: string; value: string };
  primaryAction: { label: string; href: string };
  secondaryAction: { label: string; href: string };
};

export function opportunitiesToCards(opportunities: FundingOpportunity[]): OpportunityCard[] {
  return opportunities.slice(0, 4).map((o) => {
    const badgeTone =
      o.priority === "critical" || o.priority === "high" ? "high" : "medium";

    return {
      id: o.id,
      title:
        o.stars > 1000
          ? `Library powering ${o.forks.toLocaleString()} forks`
          : `${o.fullName}`,
      subtitle: o.headline,
      badge: o.priority === "critical" ? "High impact" : o.priority === "high" ? "Unfunded" : "Opportunity",
      badgeTone,
      statA: { label: "Stars", value: o.stars.toLocaleString() },
      statB: {
        label: "Gap",
        value: `$${Math.round(o.health.fundingGapUsd).toLocaleString()}`,
      },
      primaryAction: {
        label: "Fund",
        href: `/workspace?owner=${o.owner}&repo=${o.repo}`,
      },
      secondaryAction: {
        label: "Inspect",
        href: `/workspace?owner=${o.owner}&repo=${o.repo}&autostart=0`,
      },
    };
  });
}
