/**
 * Layer 3 — Universal sensor output
 *
 * Every connector emits Observation. No exceptions.
 * Platform core must not branch on connectorId for business logic.
 *
 * Authorization (SettlementInputEvent) is a downstream projection — not this type.
 *
 * @see docs/ARCHITECTURE.md
 */

import type { EntityRef } from "@/lib/domain/entities";

/** What happened — connector-agnostic vocabulary. */
export type ObservationKind =
  | "code_contribution"
  | "code_review"
  | "code_dependency"
  | "code_usage"
  | "music_play"
  | "music_credit"
  | "research_citation"
  | "research_authorship"
  | "feed_consumption"
  | "video_view"
  | "community_moderation"
  | "identity_linked"
  | "treasury_deposit"
  | "policy_defined"
  | "authorization_created"
  | "settlement_completed"
  | "claim_completed"
  | "agent_action"
  | "other";

/**
 * Universal observation — the only object connectors emit.
 * GitHub, Navidrome, OpenAlex, Mastodon, etc. all normalize to this.
 */
export type Observation = {
  /** Stable observation ID */
  id: string;
  /** Dedup key — same key = same observation */
  idempotencyKey: string;
  /** Which sensor produced this (metadata only — never branch logic on this in core) */
  connectorId: string;
  kind: ObservationKind;
  observedAt: string;
  /** Who/what acted */
  actor?: EntityRef;
  /** Primary subject */
  subject: EntityRef;
  /** Object of the action (repo contributed to, work played, paper cited, etc.) */
  object?: EntityRef;
  /** Additional entities involved (splits, co-authors, dependencies) */
  related?: EntityRef[];
  /** Normalized metrics — plays, stars, lines, citations, amount hints */
  metrics?: Record<string, number>;
  confidence: number;
  proofHash: string;
  evidenceRefs: string[];
  /** Audit payload — intelligence layer may summarize, core graph does not depend on shape */
  raw?: unknown;
  missionId?: string;
  policyId?: string;
  causedByObservationId?: string;
};

export const OBSERVATION_KIND_LABELS: Record<ObservationKind, string> = {
  code_contribution: "Code contribution",
  code_review: "Code review",
  code_dependency: "Dependency link",
  code_usage: "Downstream usage",
  music_play: "Music play",
  music_credit: "Music credit",
  research_citation: "Research citation",
  research_authorship: "Research authorship",
  feed_consumption: "Feed consumption",
  video_view: "Video view",
  community_moderation: "Community moderation",
  identity_linked: "Identity linked",
  treasury_deposit: "Treasury deposit",
  policy_defined: "Policy defined",
  authorization_created: "Authorization created",
  settlement_completed: "Settlement completed",
  claim_completed: "Claim completed",
  agent_action: "Agent action",
  other: "Activity",
};

/** Validate required fields before ingest. Connectors call this at the boundary. */
export function validateObservation(obs: Observation): string[] {
  const errors: string[] = [];
  if (!obs.id?.trim()) errors.push("id is required");
  if (!obs.idempotencyKey?.trim()) errors.push("idempotencyKey is required");
  if (!obs.connectorId?.trim()) errors.push("connectorId is required");
  if (!obs.subject?.id) errors.push("subject.id is required");
  if (!obs.subject?.type) errors.push("subject.type is required");
  if (!obs.proofHash?.trim()) errors.push("proofHash is required");
  if (obs.confidence < 0 || obs.confidence > 1) errors.push("confidence must be 0–1");
  if (!obs.observedAt) errors.push("observedAt is required");
  return errors;
}
