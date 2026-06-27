/**
 * Adapters between legacy types and Layer 1 domain model.
 *
 * Migration path:
 *   Connector → Observation → Relationship materialization → Authorization
 *
 * Today most connectors skip Observation and emit SettlementInputEvent directly.
 * These adapters document and enable incremental migration.
 */

import type { SettlementInputEvent } from "@/lib/authorization/types";
import type { EntityRef } from "@/lib/domain/entities";
import { EntityIds } from "@/lib/domain/entities";
import type { Observation, ObservationKind } from "@/lib/domain/observation";
import type { Relationship } from "@/lib/domain/relationships";
import { defaultRelationshipForObservationKind } from "@/lib/domain/relationships";

function observationKindFromEventType(eventType: string): ObservationKind {
  const map: Record<string, ObservationKind> = {
    code_contribution: "code_contribution",
    github_contribution: "code_contribution",
    music_play: "music_play",
    navidrome_play: "music_play",
    research_citation: "research_citation",
    upstream_dependency: "code_dependency",
    consumption: "code_usage",
  };
  return map[eventType] ?? "other";
}

function payeeToEntityRef(payeeKeyType: string, payeeKey: string): EntityRef {
  if (payeeKeyType === "github_username") {
    return {
      type: "person",
      id: EntityIds.personGitHub(payeeKey),
      label: payeeKey,
    };
  }
  if (payeeKeyType === "musicbrainz_artist") {
    return {
      type: "person",
      id: EntityIds.personMusicBrainz(payeeKey),
    };
  }
  if (payeeKeyType === "wallet") {
    return {
      type: "wallet",
      id: EntityIds.wallet(payeeKey),
    };
  }
  return {
    type: "person",
    id: `person:${payeeKeyType}:${payeeKey}`,
    label: payeeKey,
  };
}

function contextToObjectRef(contextLabel: string | undefined): EntityRef | undefined {
  if (!contextLabel) return undefined;
  const slash = contextLabel.match(/^([^/]+)\/([^/]+)$/);
  if (slash) {
    return {
      type: "repository",
      id: EntityIds.repository(slash[1], slash[2]),
      label: contextLabel,
    };
  }
  return {
    type: "work",
    id: `work:context:${contextLabel}`,
    label: contextLabel,
  };
}

/** Project legacy settlement input back to universal observation (lossy but valid). */
export function settlementInputToObservation(event: SettlementInputEvent): Observation {
  const kind = observationKindFromEventType(event.eventType);
  return {
    id: event.idempotencyKey,
    idempotencyKey: event.idempotencyKey,
    connectorId: event.connectorId,
    kind,
    observedAt: event.occurredAt,
    actor: payeeToEntityRef(event.payeeKeyType, event.payeeKey),
    subject: payeeToEntityRef(event.payeeKeyType, event.payeeKey),
    object: contextToObjectRef(event.contextLabel ?? undefined),
    metrics: {
      amount_usd: event.amountUsd,
      ...(event.weight !== undefined ? { weight: event.weight } : {}),
    },
    confidence: event.confidence ?? 0.8,
    proofHash: event.proofHash,
    evidenceRefs: event.evidenceRefs,
    raw: event.rawMetadata,
    missionId: event.missionId,
    policyId: event.policyId,
    causedByObservationId: event.causedByEventId,
  };
}

/** Materialize graph edges from a single observation (Layer 4 preview). */
export function observationToRelationships(obs: Observation): Relationship[] {
  const relType = defaultRelationshipForObservationKind(obs.kind);
  if (!relType || !obs.object) return [];

  return [
    {
      id: `rel:${obs.id}:${relType}`,
      type: relType,
      from: obs.actor ?? obs.subject,
      to: obs.object,
      observedAt: obs.observedAt,
      sourceObservationId: obs.id,
      confidence: obs.confidence,
      metrics: obs.metrics,
    },
  ];
}

/** Project observation forward to authorization input (Layer 5 boundary). */
export function observationToSettlementInput(
  obs: Observation,
  input: {
    missionId: string;
    payeeKeyType: string;
    payeeKey: string;
    amountUsd: number;
  },
): SettlementInputEvent {
  return {
    connectorId: obs.connectorId,
    eventType: obs.kind,
    occurredAt: obs.observedAt,
    missionId: input.missionId,
    idempotencyKey: obs.idempotencyKey,
    payeeKeyType: input.payeeKeyType,
    payeeKey: input.payeeKey,
    amountUsd: input.amountUsd,
    weight: obs.metrics?.weight,
    proofHash: obs.proofHash,
    confidence: obs.confidence,
    contextLabel: obs.object?.label ?? obs.object?.id,
    evidenceRefs: obs.evidenceRefs,
    rawMetadata: obs.raw,
    policyId: obs.policyId,
    causedByEventId: obs.causedByObservationId,
  };
}
