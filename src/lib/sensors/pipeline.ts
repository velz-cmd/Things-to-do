import type { SettlementInputEvent } from "@/lib/authorization/types";
import { ingestSettlementBatch } from "@/lib/authorization/ledger";
import { validateObservation } from "@/lib/domain/observation";
import { observationToSettlementInput } from "@/lib/domain/adapters";
import type { Observation } from "@/lib/domain/observation";
import type { SensorProgramContext } from "@/lib/sensors/program-context";

function payeeFromObservation(obs: Observation): {
  payeeKeyType: string;
  payeeKey: string;
} | null {
  const actor = obs.actor;
  const subject = obs.subject;
  if (!actor?.id) return null;

  if (actor.id.startsWith("person:github:")) {
    return {
      payeeKeyType: "github_username",
      payeeKey: actor.id.slice("person:github:".length),
    };
  }
  if (actor.id.startsWith("person:openalex:")) {
    return {
      payeeKeyType: "openalex_author",
      payeeKey: actor.id.slice("person:openalex:".length),
    };
  }
  if (subject?.id?.startsWith("project:opencollective:")) {
    return {
      payeeKeyType: "opencollective_project",
      payeeKey: subject.id.slice("project:opencollective:".length),
    };
  }
  if (actor.label) {
    return { payeeKeyType: "person", payeeKey: actor.label.toLowerCase() };
  }
  return null;
}

function amountFromPolicy(obs: Observation, program: SensorProgramContext): number {
  const hint = obs.metrics?.amount_hint_usd;
  if (typeof hint === "number" && hint > 0) return hint;

  const rules = program.rules;
  if (program.templateId === "docs-bounty") return rules.perMergeUsd ?? 25;
  if (program.templateId === "security-fund") return rules.perCveUsd ?? 150;
  if (program.templateId === "citation-toll") return rules.perCitationUsd ?? 0.05;
  if (program.templateId === "quadratic-funding") {
    const hint = obs.metrics?.contribution_usd ?? obs.metrics?.amount_hint_usd;
    return typeof hint === "number" ? hint : 0;
  }
  return 0;
}

function eventTypeForObservation(obs: Observation, program: SensorProgramContext): string {
  if (program.templateId === "docs-bounty") return "docs.merged";
  if (program.templateId === "security-fund") return "security.advisory";
  if (program.templateId === "citation-toll") return "citation.verified";
  if (program.templateId === "quadratic-funding") return "qf.contribution";
  return obs.kind;
}

function ingestStatusForProgram(program: SensorProgramContext): "authorized" | "recognized" {
  return program.templateId === "quadratic-funding" ? "recognized" : "authorized";
}

/** Observation → Authorization — policy applies amounts; ledger stays connector-agnostic. */
export function observationsToSettlementEvents(
  observations: Observation[],
  program: SensorProgramContext,
): SettlementInputEvent[] {
  const events: SettlementInputEvent[] = [];

  for (const obs of observations) {
    const errors = validateObservation(obs);
    if (errors.length) continue;

    const payee = payeeFromObservation(obs);
    if (!payee) continue;

    const amountUsd = amountFromPolicy(obs, program);
    if (amountUsd <= 0) continue;

    const eventType = eventTypeForObservation(obs, program);
    const base = observationToSettlementInput(obs, {
      missionId: program.missionId,
      payeeKeyType: payee.payeeKeyType,
      payeeKey: payee.payeeKey,
      amountUsd,
    });

    events.push({
      ...base,
      eventType,
      policyId: program.templateId,
      contextLabel: obs.subject.label ?? obs.subject.id,
    });
  }

  return events;
}

export async function ingestObservationPipeline(input: {
  observations: Observation[];
  program: SensorProgramContext;
  founderUserId?: string;
}) {
  const events = observationsToSettlementEvents(input.observations, input.program);
  if (!events.length) {
    return {
      observations: input.observations.length,
      ingested: 0,
      skipped: input.observations.length,
      missionId: input.program.missionId,
      events: [] as SettlementInputEvent[],
    };
  }

  const batch = await ingestSettlementBatch(events, {
    founderUserId: input.founderUserId ?? input.program.founderUserId,
    status: ingestStatusForProgram(input.program),
  });

  return {
    observations: input.observations.length,
    ingested: batch.count,
    skipped: input.observations.length - batch.count,
    missionId: input.program.missionId,
    events,
  };
}
