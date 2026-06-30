import type { DomainIntelligence } from "@/lib/workspace/domain-intelligence";
import type { FundingOpportunity } from "@/lib/github/types";
import type { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";

type LedgerSummary = Awaited<ReturnType<typeof getGlobalAuthorizationSummary>>;

export type NetworkIntelligence = {
  recognizedUsd: number;
  pendingFundingUsd: number;
  claimableUsd: number;
  settledUsd: number;
  leakingUsd: number;
  /** Human label for the leaking/pending chip — avoids "leaking" when treasury unknown */
  flowGapLabel: "Leaking" | "Pending funding";
  treasuryBalanceUsd: number;
  obligationsUsd: number;
  topRisks: { label: string; level: "critical" | "high" | "medium" | "low"; detail: string }[];
  opportunitiesTracked: number;
  criticalGaps: number;
  sensorsOnline: number;
  eventsToday: number;
  headline: string;
};

function riskLevel(
  priority: FundingOpportunity["priority"],
): NetworkIntelligence["topRisks"][number]["level"] {
  if (priority === "critical") return "critical";
  if (priority === "high") return "high";
  if (priority === "medium") return "medium";
  return "low";
}

/** Real ledger + opportunity data only — no fabricated market caps. */
export function buildNetworkIntelligence(input: {
  ledger: LedgerSummary | null;
  treasuryBalanceUsd: number;
  obligationsUsd: number;
  treasuryConfigured?: boolean;
  domainIntelligence: DomainIntelligence[];
  opportunities: FundingOpportunity[];
  sensorsOnline: number;
  eventsToday: number;
}): NetworkIntelligence {
  const recognizedUsd = input.ledger?.authorizedUsd ?? 0;
  const pendingFundingUsd = input.ledger?.pendingFundingUsd ?? 0;
  const claimableUsd = input.ledger?.claimableUsd ?? 0;
  const settledUsd = input.ledger?.settledUsd ?? 0;

  const treasuryConfigured = input.treasuryConfigured ?? false;
  const treasuryGap = treasuryConfigured
    ? Math.max(0, input.obligationsUsd - input.treasuryBalanceUsd)
    : 0;
  const leakingUsd = pendingFundingUsd + treasuryGap;
  const flowGapLabel =
    treasuryConfigured && treasuryGap > 0 ? "Leaking" : "Pending funding";

  const opportunityRisks = input.opportunities
    .filter((o) => o.priority === "critical" || o.priority === "high")
    .slice(0, 4)
    .map((o) => ({
      label: o.fullName,
      level: riskLevel(o.priority),
      detail: o.headline,
    }));

  const domainRisks = input.domainIntelligence
    .filter((d) => d.risk && d.status === "live")
    .slice(0, 3)
    .map((d) => ({
      label: d.label,
      level: "medium" as const,
      detail: d.risk ?? d.signal,
    }));

  const topRisks = [...opportunityRisks, ...domainRisks].slice(0, 5);
  const criticalGaps = input.opportunities.filter((o) => o.priority === "critical").length;

  const headline =
    recognizedUsd > 0
      ? `$${recognizedUsd.toFixed(0)} recognized · $${leakingUsd.toFixed(0)} ${flowGapLabel.toLowerCase()}`
      : input.sensorsOnline > 0
        ? `${input.sensorsOnline} sensor${input.sensorsOnline === 1 ? "" : "s"} online — value discovery active`
        : "Connect ecosystems where work already happens";

  return {
    recognizedUsd,
    pendingFundingUsd,
    claimableUsd,
    settledUsd,
    leakingUsd,
    flowGapLabel,
    treasuryBalanceUsd: input.treasuryBalanceUsd,
    obligationsUsd: input.obligationsUsd,
    topRisks,
    opportunitiesTracked: input.opportunities.length,
    criticalGaps,
    sensorsOnline: input.sensorsOnline,
    eventsToday: input.eventsToday,
    headline,
  };
}
