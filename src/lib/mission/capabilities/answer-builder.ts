import type { OrchestratorContext } from "./types";
import type { FundingOpportunity } from "@/lib/github/types";

function formatUsd(n: number, compact = false) {
  if (compact && n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function describeRepo(o: FundingOpportunity): string {
  return `${o.fullName} (${o.stars.toLocaleString()} stars, ${o.health.maintainerCount} maintainer${o.health.maintainerCount === 1 ? "" : "s"}, ${formatUsd(o.health.fundingGapUsd)} gap)`;
}

/** Deterministic, evidence-grounded answer — never generic replay templates. */
export function buildGroundedAnswer(ctx: OrchestratorContext): string {
  const { capability, evidence, opportunities, findings, capitalUsd, compareTargets, ecosystemName } =
    ctx;
  const scope = ecosystemName ?? ctx.compareTargets[0] ?? null;
  const totalGap = opportunities.reduce((s, o) => s + o.health.fundingGapUsd, 0);
  const top = opportunities[0];
  const critical = opportunities.filter((o) => o.priority === "critical" || o.priority === "high");

  switch (capability) {
    case "discover_value_leaks": {
      if (!opportunities.length) {
        return scope ?
            `I don't have live repository data scoped to ${scope} yet. Connect code ecosystems on Profile, or name a specific repository to scan.`
          : "No repositories are being observed yet. Connect an ecosystem or name a project to scan for value leaks.";
      }
      if (totalGap <= 0) {
        return scope ?
            `Across ${scope} repositories I can see, maintenance demand looks funded relative to observed activity — no major leaks right now.`
          : "Observed projects show no major unfunded maintenance gaps at current scan depth.";
      }
      const lead = scope ?
        `In ${scope}, I traced ${opportunities.length} observed project${opportunities.length === 1 ? "" : "s"} with ${formatUsd(totalGap, true)} in unfunded maintenance demand.`
      : `Across connected ecosystems, I found ${formatUsd(totalGap, true)} in unfunded maintenance demand across ${opportunities.length} observed projects.`;
      const focus = top ? ` The sharpest leak is ${describeRepo(top)}.` : "";
      const treasury =
        evidence.treasury.obligationsUsd > 0 ?
          ` Treasury covers ${Math.round(Math.min(100, (evidence.treasury.balanceUsd / evidence.treasury.obligationsUsd) * 100))}% of outstanding obligations.`
        : "";
      return `${lead}${focus}${treasury}`.trim();
    }

    case "allocate_capital": {
      const amount = capitalUsd ?? 100_000;
      if (!opportunities.length || totalGap <= 0) {
        return `With ${formatUsd(amount)} to deploy, I need observed funding gaps first. Name ecosystems to scan or connect repositories so allocation weights come from live data — not guesses.`;
      }
      const spendable = Math.round(amount * 0.85);
      const gapTotal = totalGap || 1;
      const parts = opportunities.slice(0, 4).map((o) => {
        const amt = Math.round((o.health.fundingGapUsd / gapTotal) * spendable);
        return `${o.fullName}: ${formatUsd(amt)}`;
      });
      const allocated = opportunities
        .slice(0, 4)
        .reduce((s, o) => s + Math.round((o.health.fundingGapUsd / gapTotal) * spendable), 0);
      const reserve = Math.max(0, amount - allocated);
      return `Deploying ${formatUsd(amount)} against ${formatUsd(totalGap)} in observed unfunded demand: ${parts.join(" · ")}${reserve > 0 ? ` · Reserve ${formatUsd(reserve)}` : ""}. Weights follow live gap data from ${opportunities.length} scanned repositories.`;
    }

    case "compare_ecosystems": {
      const [a, b] = compareTargets;
      if (!a || !b) {
        return "Name two ecosystems to compare — e.g. Compare React and Vue — and I'll pull live repository signals side by side.";
      }
      const left = opportunities.filter((o) => o.fullName.toLowerCase().includes(a) || o.repo.toLowerCase().includes(a));
      const right = opportunities.filter((o) => o.fullName.toLowerCase().includes(b) || o.repo.toLowerCase().includes(b));
      if (!left.length && !right.length) {
        return `${a} and ${b} aren't in the current observation set. I can scan specific repositories if you paste owner/repo links.`;
      }
      const summarize = (label: string, list: FundingOpportunity[]) => {
        if (!list.length) return `${label}: not yet observed`;
        const gap = list.reduce((s, o) => s + o.health.fundingGapUsd, 0);
        const stars = Math.max(...list.map((o) => o.stars));
        const maint = Math.min(...list.map((o) => o.health.maintainerCount));
        return `${label}: ${formatUsd(gap)} funding gap · ${stars.toLocaleString()} stars peak · ${maint} maintainer(s) min`;
      };
      return `${summarize(a, left)}. ${summarize(b, right)}. ${left.length && right.length ? (left[0]!.health.fundingGapUsd > right[0]!.health.fundingGapUsd ? `${a} shows larger unfunded maintenance demand in observed repos.` : `${b} shows larger unfunded maintenance demand in observed repos.`) : ""}`.trim();
    }

    case "assess_risk": {
      const riskRepo = opportunities.find((o) => o.priority === "critical" && o.health.maintainerCount <= 2) ?? top;
      if (!riskRepo) {
        return "No critical bus-factor risk surfaced in observed repositories right now.";
      }
      return `Highest downstream risk: ${riskRepo.fullName} — ${riskRepo.health.maintainerCount} active maintainer${riskRepo.health.maintainerCount === 1 ? "" : "s"} supporting ${riskRepo.stars.toLocaleString()} stars and ${riskRepo.forks.toLocaleString()} forks. If maintenance stalls, dependency chains across ${riskRepo.forks.toLocaleString()}+ forks face elevated exposure.`;
    }

    case "claim_value": {
      const claimable = evidence.ledger?.claimableUsd ?? 0;
      if (claimable <= 0) {
        return "No claimable value in the authorization ledger yet. Connect GitHub or music ecosystems so contributions can be recognized.";
      }
      return `You have ${formatUsd(claimable)} claimable across ${evidence.ledger!.count} recognized authorization${evidence.ledger!.count === 1 ? "" : "s"}. ${evidence.treasury.canSettleGlobally ? "Treasury is ready for settlement." : "Treasury needs funding before global settlement."}`;
    }

    case "research_ecosystem": {
      const label = scope ?? "connected ecosystems";
      if (!opportunities.length) {
        return `Researching ${label}: no live repository scans yet. Paste a repository or connect sensors to build a research view.`;
      }
      const summary = critical.slice(0, 3).map(describeRepo).join("; ");
      return `Research view for ${label}: ${opportunities.length} repositories observed. Priority signals: ${summary}. Total maintenance gap ${formatUsd(totalGap)}.`;
    }

    case "explain_evidence": {
      const finding = findings[0];
      if (!finding) {
        return "Ask about a specific discovery and I'll trace the evidence behind it.";
      }
      const parts = [finding.insight];
      if (finding.impact) parts.push(finding.impact);
      return parts.join(" ");
    }

    case "execute_settlement": {
      const { treasury, ledger } = evidence;
      if (!ledger || ledger.pendingFundingUsd <= 0) {
        return treasury.canSettleGlobally ?
            `Treasury holds ${formatUsd(treasury.balanceUsd)} with no pending authorizations awaiting fulfillment.`
          : `Settlement blocked: treasury ${formatUsd(treasury.balanceUsd)} vs ${formatUsd(treasury.obligationsUsd)} in obligations.`;
      }
      return `Ready to review settlement: ${formatUsd(ledger.pendingFundingUsd)} pending across ${ledger.count} authorization${ledger.count === 1 ? "" : "s"}. Treasury ${formatUsd(treasury.balanceUsd)} available.`;
    }

  case "general_inquiry":
    default: {
      if (findings.length > 0 && top) {
        return `From live scans: ${describeRepo(top)} leads observed ecosystems. ${findings.length > 1 ? `${findings.length - 1} additional signal${findings.length === 2 ? "" : "s"} below.` : ""}`.trim();
      }
      if (evidence.ledger && evidence.ledger.claimableUsd > 0) {
        return `You have ${formatUsd(evidence.ledger.claimableUsd)} claimable. ${opportunities.length ? `Top observed project: ${top ? describeRepo(top) : "n/a"}.` : ""}`.trim();
      }
      return opportunities.length ?
          `Observing ${opportunities.length} repositories. Ask about funding gaps, risk, allocation, or claims — each invokes a different capability on live data.`
        : "RESOLVE is connected but no repository scans are loaded. Ask about a specific ecosystem or paste a GitHub repository to begin.";
    }
  }
}
