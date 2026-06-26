import type { WorkspaceEvidence } from "@/lib/workspace/context";
import { domainLabel } from "@/lib/workspace/domains";

export type ValueConcentration = {
  id: string;
  title: string;
  detail: string;
  domain?: string;
};

/** Real value concentrations from evidence — never invented. */
export function buildValueConcentrations(evidence: WorkspaceEvidence): ValueConcentration[] {
  const out: ValueConcentration[] = [];
  const { ledger, opportunities, connectors, treasury } = evidence;

  if (ledger && ledger.count > 0) {
    out.push({
      id: "ledger",
      title: "Recognized value in ledger",
      detail: `${ledger.count} authorization${ledger.count === 1 ? "" : "s"} · $${(ledger.authorizedUsd + ledger.pendingFundingUsd + ledger.claimableUsd).toFixed(2)} USDC total · $${ledger.claimableUsd.toFixed(2)} claimable now`,
    });
  }

  const critical = opportunities.filter((o) => o.priority === "critical" || o.priority === "high");
  for (const opp of critical.slice(0, 2)) {
    out.push({
      id: opp.id,
      title: `${opp.fullName} — ${opp.headline}`,
      detail: `${opp.stars.toLocaleString()} stars · funding gap $${opp.health.fundingGapUsd.toLocaleString()} · ${opp.unfundedMaintainers} maintainer(s) underfunded`,
      domain: "code",
    });
  }

  const music = connectors.find((c) => c.id === "navidrome");
  if (music && (music.authorizationCount > 0 || music.health === "healthy")) {
    out.push({
      id: "music",
      title: "Music attribution active",
      detail: `${music.authorizationCount} listen authorization${music.authorizationCount === 1 ? "" : "s"} · ${music.eventsToday} events today`,
      domain: "music",
    });
  } else if (music?.health === "syncing" || music?.health === "waiting") {
    out.push({
      id: "music-pending",
      title: "Music value not yet flowing",
      detail: "Enable ListenBrainz sync or Navidrome bridge to capture unpaid listens.",
      domain: "music",
    });
  }

  const liveConnectors = connectors.filter((c) => c.health === "healthy");
  if (liveConnectors.length > 0) {
    out.push({
      id: "sensors",
      title: "Live sensors",
      detail: liveConnectors.map((c) => domainLabel(c.id)).join(" · "),
    });
  }

  if (treasury.obligationsUsd > treasury.balanceUsd && treasury.balanceUsd > 0) {
    out.push({
      id: "treasury-gap",
      title: "Treasury gap",
      detail: `Obligations $${treasury.obligationsUsd.toFixed(2)} exceed balance $${treasury.balanceUsd.toFixed(2)}`,
    });
  }

  if (!out.length) {
    out.push({
      id: "connect",
      title: "Connect open ecosystems",
      detail: "Sensors are ready. Value will concentrate here as activity is discovered.",
    });
  }

  return out.slice(0, 5);
}
