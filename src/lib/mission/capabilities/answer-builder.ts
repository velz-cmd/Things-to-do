import type { OrchestratorContext } from "./types";
import type { FundingOpportunity } from "@/lib/github/types";
import { LAYER_LABELS } from "@/lib/mission/community";

function formatUsd(n: number, compact = false) {
  if (compact && n >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function describeSignal(o: FundingOpportunity): string {
  return `${o.fullName} (${o.stars.toLocaleString()} stars, ${o.health.maintainerCount} contributor${o.health.maintainerCount === 1 ? "" : "s"}, ${formatUsd(o.health.fundingGapUsd)} gap)`;
}

function communityScope(ctx: OrchestratorContext): string {
  return ctx.communityName ?? ctx.community.name ?? ctx.community.kindLabel;
}

function noObservationMessage(ctx: OrchestratorContext): string {
  const scope = communityScope(ctx);
  const kind = ctx.community.kind;

  if (kind === "music") {
    return scope ?
        `I don't have live music community signals for ${scope} yet. Connect ListenBrainz or Navidrome on Profile — RESOLVE will observe plays, credits, and patronage gaps.`
      : "Connect music identities on Profile so RESOLVE can observe artists, listens, and unfunded creative value.";
  }
  if (kind === "research" || kind === "science") {
    return scope ?
        `Research community ${scope} needs observation signals — citations, grants, and group activity. OpenAlex integration expands this view.`
      : "Ask about a research community by name — RESOLVE will pull citation and grant signals where available.";
  }
  if (kind === "education") {
    return "Open education communities need teaching, course, and contributor signals. Name a community to begin observation.";
  }
  if (kind === "local") {
    return scope ?
        `Building understanding of ${scope} — local maintainers, universities, and organizations. Link identities on Profile to deepen attribution.`
      : "Name a local or regional open community — RESOLVE will map maintainers and funding gaps from available sensors.";
  }

  return scope ?
      `No live observation signals for ${scope} yet. Name a community world or link identities on Profile.`
    : "RESOLVE is ready — ask about a community (Linux, independent music, climate research…) and observation will route automatically.";
}

/** Deterministic, evidence-grounded answer — community-first, never connector-first. */
export function buildGroundedAnswer(ctx: OrchestratorContext): string {
  const { capability, evidence, opportunities, findings, capitalUsd, compareTargets } = ctx;
  const scope = communityScope(ctx);
  const totalGap = opportunities.reduce((s, o) => s + o.health.fundingGapUsd, 0);
  const top = opportunities[0];
  const critical = opportunities.filter((o) => o.priority === "critical" || o.priority === "high");
  const isCodeShaped = ctx.community.kind === "oss" || ctx.community.kind === "protocol" || ctx.community.kind === "general";

  switch (capability) {
    case "discover_value_leaks": {
      if (!isCodeShaped && !opportunities.length) {
        return noObservationMessage(ctx);
      }
      if (!opportunities.length) {
        return noObservationMessage(ctx);
      }
      if (totalGap <= 0) {
        return scope ?
            `Across ${scope}, observed communities show no major unfunded value gaps at current observation depth.`
          : "Observed communities show no major unfunded value gaps at current scan depth.";
      }
      const lead = scope ?
        `In ${scope}, I traced ${opportunities.length} signal${opportunities.length === 1 ? "" : "s"} with ${formatUsd(totalGap, true)} in unfunded value.`
      : `Across observed communities, I found ${formatUsd(totalGap, true)} in unfunded value across ${opportunities.length} signals.`;
      const focus = top && isCodeShaped ? ` The sharpest leak: ${describeSignal(top)}.` : "";
      const treasury =
        evidence.treasury.obligationsUsd > 0 ?
          ` Treasury covers ${Math.round(Math.min(100, (evidence.treasury.balanceUsd / evidence.treasury.obligationsUsd) * 100))}% of outstanding obligations.`
        : "";
      return `${lead}${focus}${treasury}`.trim();
    }

    case "allocate_capital": {
      const amount = capitalUsd ?? 100_000;
      if (!opportunities.length || totalGap <= 0) {
        return `With ${formatUsd(amount)} to deploy, I need observed funding gaps in ${scope}. Name a community or link identities so allocation weights come from live evidence — not guesses.`;
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
      return `Deploying ${formatUsd(amount)} against ${formatUsd(totalGap)} in observed unfunded demand: ${parts.join(" · ")}${reserve > 0 ? ` · Reserve ${formatUsd(reserve)}` : ""}. Weights follow ${LAYER_LABELS.capital} evidence from ${opportunities.length} observed signals.`;
    }

    case "compare_ecosystems": {
      const [a, b] = compareTargets;
      if (!a || !b) {
        return "Name two communities to compare — e.g. Compare React and Vue — and RESOLVE will pull live signals side by side.";
      }
      const left = opportunities.filter((o) =>
        o.fullName.toLowerCase().includes(a.toLowerCase()) || o.repo.toLowerCase().includes(a.toLowerCase()),
      );
      const right = opportunities.filter((o) =>
        o.fullName.toLowerCase().includes(b.toLowerCase()) || o.repo.toLowerCase().includes(b.toLowerCase()),
      );
      if (!left.length && !right.length) {
        return `${a} and ${b} aren't in the current observation set yet. RESOLVE will route ${ctx.community.kindLabel} sensors automatically when signals arrive.`;
      }
      const summarize = (label: string, list: FundingOpportunity[]) => {
        if (!list.length) return `${label}: not yet observed`;
        const gap = list.reduce((s, o) => s + o.health.fundingGapUsd, 0);
        const stars = Math.max(...list.map((o) => o.stars));
        const maint = Math.min(...list.map((o) => o.health.maintainerCount));
        return `${label}: ${formatUsd(gap)} funding gap · ${stars.toLocaleString()} stars peak · ${maint} contributor(s) min`;
      };
      return `${summarize(a, left)}. ${summarize(b, right)}.`.trim();
    }

    case "assess_risk": {
      const riskRepo = opportunities.find((o) => o.priority === "critical" && o.health.maintainerCount <= 2) ?? top;
      if (!riskRepo) {
        return `No critical bus-factor risk surfaced in ${scope} at current observation depth.`;
      }
      return `Highest downstream risk in ${scope}: ${riskRepo.fullName} — ${riskRepo.health.maintainerCount} active contributor${riskRepo.health.maintainerCount === 1 ? "" : "s"} supporting ${riskRepo.stars.toLocaleString()} stars and ${riskRepo.forks.toLocaleString()} forks.`;
    }

    case "claim_value": {
      const claimable = evidence.ledger?.claimableUsd ?? 0;
      if (claimable <= 0) {
        return "No claimable value in the authorization ledger yet. Link community identities on Profile so contributions can be recognized.";
      }
      return `You have ${formatUsd(claimable)} claimable across ${evidence.ledger!.count} recognized authorization${evidence.ledger!.count === 1 ? "" : "s"}. ${evidence.treasury.canSettleGlobally ? "Treasury is ready for settlement." : "Treasury needs funding before global settlement."}`;
    }

    case "research_ecosystem": {
      const label = scope;
      if (!opportunities.length && ctx.community.kind !== "oss") {
        return `Research view for ${label} (${ctx.community.kindLabel}): observation routed through ${ctx.community.sensors.slice(0, 3).map((s) => s.evidenceLabel).join(", ") || "community sensors"}. Connect identities to deepen signals.`;
      }
      if (!opportunities.length) {
        return `Researching ${label}: no live observation signals yet. Name a community or link identities to build a research view.`;
      }
      const summary = critical.slice(0, 3).map(describeSignal).join("; ");
      return `Research view for ${label}: ${opportunities.length} signals observed. Priority: ${summary}. Total unfunded value ${formatUsd(totalGap)}.`;
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
      if (ctx.community.kind === "music" && !opportunities.length) {
        return "For music communities, RESOLVE observes listens, credits, and patronage gaps — not repositories. Connect ListenBrainz on Profile or ask which musicians create value without fair pay.";
      }
      if (ctx.community.kind === "research" && !opportunities.length) {
        return "For research communities, RESOLVE maps citations, groups, and grant history. Ask which research communities deserve funding — observation routes through research sensors automatically.";
      }
      if (findings.length > 0 && top && isCodeShaped) {
        return `From live observation: ${describeSignal(top)} leads ${scope}. ${findings.length > 1 ? `${findings.length - 1} additional signal${findings.length === 2 ? "" : "s"} below.` : ""}`.trim();
      }
      if (evidence.ledger && evidence.ledger.claimableUsd > 0) {
        return `You have ${formatUsd(evidence.ledger.claimableUsd)} claimable. ${opportunities.length && top ? `Top observed signal: ${describeSignal(top)}.` : ""}`.trim();
      }
      return opportunities.length ?
          `Observing ${opportunities.length} signals in ${scope}. Ask about value leaks, risk, allocation, or claims — each invokes a different capability on live evidence.`
        : noObservationMessage(ctx);
    }
  }
}
