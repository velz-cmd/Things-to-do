import type { WorkspaceEvidence } from "@/lib/workspace/context";

export type EvidenceAction = {
  id: string;
  label: string;
  detail: string;
  href: string;
  priority: "high" | "medium" | "low";
  pillar: "intelligence" | "capital_flow" | "authorization" | "distribution" | "settlement";
  evidence: string;
};

/** Evidence-backed next steps — never generic advice. */
export function buildEvidenceActions(evidence: WorkspaceEvidence): EvidenceAction[] {
  const actions: EvidenceAction[] = [];
  const { treasury, ledger, connectors, opportunities } = evidence;

  if ((ledger?.claimableUsd ?? 0) > 0) {
    actions.push({
      id: "claim",
      label: "Claim your earnings",
      detail: `$${ledger!.claimableUsd.toFixed(2)} USDC is claimable across the ledger.`,
      href: "/claim",
      priority: "high",
      pillar: "settlement",
      evidence: `ledger.claimableUsd=${ledger!.claimableUsd}`,
    });
  }

  if (treasury.obligationsUsd > treasury.balanceUsd && treasury.balanceUsd > 0) {
    actions.push({
      id: "fund-partial",
      label: "Fund treasury to cover obligations",
      detail: `Obligations ($${treasury.obligationsUsd.toFixed(2)}) exceed balance ($${treasury.balanceUsd.toFixed(2)}).`,
      href: "/payments",
      priority: "high",
      pillar: "capital_flow",
      evidence: `treasury.obligationsUsd=${treasury.obligationsUsd} balance=${treasury.balanceUsd}`,
    });
  } else if (treasury.balanceUsd < 0.01 && (ledger?.count ?? 0) > 0) {
    actions.push({
      id: "fund-empty",
      label: "Fund treasury for global settlement",
      detail: "Authorizations exist but treasury is empty — batch settlement blocked.",
      href: "/payments",
      priority: "high",
      pillar: "capital_flow",
      evidence: `treasury.balanceUsd=${treasury.balanceUsd} ledger.count=${ledger?.count}`,
    });
  }

  if ((ledger?.pendingFundingUsd ?? 0) > 0) {
    actions.push({
      id: "settle-pending",
      label: "Review pending settlement",
      detail: `$${ledger!.pendingFundingUsd.toFixed(2)} USDC authorized and awaiting fulfillment.`,
      href: "/payments",
      priority: "medium",
      pillar: "settlement",
      evidence: `ledger.pendingFundingUsd=${ledger!.pendingFundingUsd}`,
    });
  }

  const music = connectors.find((c) => c.id === "navidrome");
  if (music?.health === "waiting" || music?.health === "syncing") {
    actions.push({
      id: "music-sync",
      label: "Enable music attribution sync",
      detail:
        music.health === "syncing"
          ? "Music sensors configured — trigger ListenBrainz sync to ingest scrobbles."
          : "Connect Navidrome or ListenBrainz so plays become authorizations.",
      href: "/profile",
      priority: "medium",
      pillar: "distribution",
      evidence: `navidrome.health=${music.health} events=${music.eventsToday}`,
    });
  }

  const github = connectors.find((c) => c.id === "github");
  if (github?.health !== "healthy") {
    actions.push({
      id: "connect-code",
      label: "Connect code ecosystems",
      detail: "GitHub sensor offline — code contributions won't be recognized.",
      href: "/profile",
      priority: "medium",
      pillar: "distribution",
      evidence: `github.health=${github?.health ?? "unknown"}`,
    });
  }

  const critical = opportunities.find((o) => o.priority === "critical" || o.priority === "high");
  if (critical) {
    actions.push({
      id: "discover-repo",
      label: `Fund ${critical.fullName}`,
      detail: `${critical.headline} · ${critical.stars.toLocaleString()} stars · gap $${critical.health.fundingGapUsd.toLocaleString()}`,
      href: `/workspace?owner=${critical.owner}&repo=${critical.repo}`,
      priority: "low",
      pillar: "intelligence",
      evidence: `opportunity.${critical.id} priority=${critical.priority}`,
    });
  }

  if (evidence.capitalFlow.participantCount > 0 && treasury.canSettleGlobally) {
    actions.push({
      id: "batch-scale",
      label: `Batch settle ${evidence.capitalFlow.participantCount} participants`,
      detail: evidence.capitalFlow.scaleMessage,
      href: "/payments",
      priority: "medium",
      pillar: "capital_flow",
      evidence: `capitalFlow.participantCount=${evidence.capitalFlow.participantCount}`,
    });
  }

  if (!actions.length) {
    actions.push({
      id: "explore",
      label: "Discover value in open ecosystems",
      detail: "Sensors are online. Paste a project or wait for activity to stream in.",
      href: "/workspace#discover",
      priority: "low",
      pillar: "intelligence",
      evidence: "no urgent ledger or treasury signals",
    });
  }

  return actions
    .sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    })
    .slice(0, 5);
}
