import type { WorkspaceEvidence } from "@/lib/workspace/context";
import { domainLabel } from "@/lib/workspace/domains";
import { buildEvidenceActions } from "@/lib/workspace/advisors/evidence-actions";
import { buildValueConcentrations } from "@/lib/workspace/advisors/concentrations";

/** The six questions every Workspace surface must answer. */
export type OsQuestionId =
  | "value_happening"
  | "value_leaking"
  | "who_created"
  | "unpaid"
  | "who_funds"
  | "what_next";

export type OsQuestionAnswer = {
  id: OsQuestionId;
  question: string;
  summary: string;
  bullets: string[];
  metric?: { label: string; value: string };
  empty: boolean;
};

const QUESTIONS: Record<OsQuestionId, string> = {
  value_happening: "Where is value happening?",
  value_leaking: "Where is value leaking?",
  who_created: "Who created it?",
  unpaid: "Who hasn't been paid?",
  who_funds: "Who should fund it?",
  what_next: "What should happen next?",
};

/** Map live evidence → six permanent OS questions. Real data only. */
export function buildSixQuestionAnswers(evidence: WorkspaceEvidence): OsQuestionAnswer[] {
  const { ledger, treasury, connectors, opportunities } = evidence;
  const concentrations = buildValueConcentrations(evidence);
  const actions = buildEvidenceActions(evidence);

  const recognizedUsd = ledger
    ? ledger.authorizedUsd + ledger.pendingFundingUsd + ledger.claimableUsd
    : 0;

  const liveSensors = connectors.filter(
    (c) => c.health === "healthy" || c.authorizationCount > 0,
  );
  const domainSignals = liveSensors.map(
    (c) =>
      `${domainLabel(c.id)}: ${c.eventsToday} events today · ${c.authorizationCount} recognized`,
  );

  const valueHappening: OsQuestionAnswer = {
    id: "value_happening",
    question: QUESTIONS.value_happening,
    summary:
      recognizedUsd > 0
        ? `Your open ecosystems created $${recognizedUsd.toFixed(2)} of recognized value.`
        : liveSensors.length > 0
          ? `${liveSensors.length} sensor${liveSensors.length === 1 ? "" : "s"} online — value will appear as activity is observed.`
          : "No value recognized yet. Sensors stand by across open ecosystems.",
    bullets:
      domainSignals.length > 0
        ? domainSignals
        : concentrations.slice(0, 3).map((c) => `${c.title} — ${c.detail}`),
    metric:
      recognizedUsd > 0
        ? { label: "Recognized", value: `$${recognizedUsd.toFixed(2)}` }
        : undefined,
    empty: recognizedUsd === 0 && domainSignals.length === 0,
  };

  const leaks: string[] = [];
  if ((ledger?.pendingFundingUsd ?? 0) > 0) {
    leaks.push(
      `$${ledger!.pendingFundingUsd.toFixed(2)} authorized but not yet funded — capital stalled in pipeline`,
    );
  }
  if (treasury.obligationsUsd > treasury.balanceUsd && treasury.balanceUsd > 0) {
    leaks.push(
      `Treasury gap: $${(treasury.obligationsUsd - treasury.balanceUsd).toFixed(2)} in unfunded obligations`,
    );
  }
  const critical = opportunities.filter((o) => o.priority === "critical" || o.priority === "high");
  for (const o of critical.slice(0, 2)) {
    leaks.push(
      `${o.fullName}: ${o.unfundedMaintainers} maintainer(s) underfunded · gap $${o.health.fundingGapUsd.toLocaleString()}`,
    );
  }
  const waitingGithub = connectors.find((c) => c.id === "github" && c.health !== "healthy");
  if (waitingGithub && (ledger?.count ?? 0) === 0) {
    leaks.push("Code sensor offline — contributions may be invisible until connected");
  }

  const valueLeaking: OsQuestionAnswer = {
    id: "value_leaking",
    question: QUESTIONS.value_leaking,
    summary:
      leaks.length > 0
        ? `${leaks.length} leak${leaks.length === 1 ? "" : "s"} detected in the value graph.`
        : "No active leaks detected in connected sensors.",
    bullets: leaks.length > 0 ? leaks : ["Connect more sensors to surface attribution gaps"],
    empty: leaks.length === 0,
  };

  const creators: string[] = [];
  if (ledger && ledger.count > 0) {
    creators.push(
      `${ledger.count} participant${ledger.count === 1 ? "" : "s"} recognized across the authorization ledger`,
    );
  }
  for (const c of concentrations.filter((x) => x.domain).slice(0, 3)) {
    creators.push(c.detail);
  }

  const whoCreated: OsQuestionAnswer = {
    id: "who_created",
    question: QUESTIONS.who_created,
    summary:
      creators.length > 0
        ? "Creators and maintainers identified through attribution sensors."
        : "No creators recognized yet — value attribution awaits sensor activity.",
    bullets: creators,
    empty: creators.length === 0,
  };

  const unpaidBullets: string[] = [];
  if ((ledger?.claimableUsd ?? 0) > 0) {
    unpaidBullets.push(`$${ledger!.claimableUsd.toFixed(2)} claimable now`);
  }
  if ((ledger?.pendingFundingUsd ?? 0) > 0) {
    unpaidBullets.push(`$${ledger!.pendingFundingUsd.toFixed(2)} awaiting funding`);
  }
  if ((ledger?.authorizedUsd ?? 0) > 0) {
    unpaidBullets.push(`$${ledger!.authorizedUsd.toFixed(2)} authorized, settlement pending`);
  }

  const unpaid: OsQuestionAnswer = {
    id: "unpaid",
    question: QUESTIONS.unpaid,
    summary:
      unpaidBullets.length > 0
        ? "Capital is owed to recognized participants."
        : "No unpaid authorizations in the ledger.",
    bullets: unpaidBullets,
    metric:
      (ledger?.claimableUsd ?? 0) > 0
        ? { label: "Claimable", value: `$${ledger!.claimableUsd.toFixed(2)}` }
        : undefined,
    empty: unpaidBullets.length === 0,
  };

  const fundBullets: string[] = [];
  if (treasury.balanceUsd > 0) {
    fundBullets.push(
      `Treasury holds $${treasury.balanceUsd.toFixed(2)} — $${treasury.availableUsd.toFixed(2)} available`,
    );
  } else if ((ledger?.count ?? 0) > 0) {
    fundBullets.push("Treasury empty — funders needed to fulfill authorizations");
  }
  if (treasury.canSettleGlobally) {
    fundBullets.push("Arc settlement rail ready for batch execution");
  } else if (treasury.blockers.length) {
    fundBullets.push(`Settlement blocked: ${treasury.blockers[0]}`);
  }

  const whoFunds: OsQuestionAnswer = {
    id: "who_funds",
    question: QUESTIONS.who_funds,
    summary:
      treasury.balanceUsd > 0
        ? "Capital exists — allocation policies decide where it flows."
        : "Communities, founders, and DAOs fund when authorizations exist.",
    bullets: fundBullets,
    empty: fundBullets.length === 0,
  };

  const whatNext: OsQuestionAnswer = {
    id: "what_next",
    question: QUESTIONS.what_next,
    summary:
      actions.length > 0
        ? `${actions.length} evidence-backed action${actions.length === 1 ? "" : "s"} recommended.`
        : "Continue observing — actions appear when value concentrates.",
    bullets: actions.slice(0, 4).map((a) => `${a.label} — ${a.detail}`),
    empty: actions.length === 0,
  };

  return [valueHappening, valueLeaking, whoCreated, unpaid, whoFunds, whatNext];
}

export function buildBriefingHeadline(answers: OsQuestionAnswer[]): string {
  const happening = answers.find((a) => a.id === "value_happening");
  const leaking = answers.find((a) => a.id === "value_leaking");
  const unpaid = answers.find((a) => a.id === "unpaid");

  if (happening?.metric) {
    const leakPart =
      !leaking?.empty ? ` · ${leaking!.bullets.length} leak${leaking!.bullets.length === 1 ? "" : "s"} detected` : "";
    const unpaidPart =
      unpaid?.metric ? ` · ${unpaid.metric.value} claimable` : "";
    return `${happening.metric.value} recognized across open ecosystems${leakPart}${unpaidPart}.`;
  }

  return happening?.summary ?? "Observing open ecosystems for value flow.";
}
