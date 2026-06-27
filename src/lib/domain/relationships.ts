/**
 * Layer 1 — Relationships (edges in the Value Graph)
 *
 * Observations materialize into relationships. Capital reasoning traverses edges.
 *
 * @see docs/ARCHITECTURE.md Layer 4
 */

import type { EntityRef } from "@/lib/domain/entities";

/** Frozen relationship taxonomy. */
export type RelationshipType =
  | "authored"
  | "maintains"
  | "contributed_to"
  | "depends_on"
  | "used_by"
  | "cited_by"
  | "credited_to"
  | "member_of"
  | "owns"
  | "funds"
  | "authorized_for"
  | "settled_to"
  | "claimed_by"
  | "listened_to"
  | "published"
  | "moderates"
  | "powers"
  | "downstream_of"
  | "upstream_of";

export type Relationship = {
  id: string;
  type: RelationshipType;
  from: EntityRef;
  to: EntityRef;
  /** ISO timestamp when relationship was observed or inferred */
  observedAt: string;
  /** Observation that produced this edge */
  sourceObservationId: string;
  confidence: number;
  /** Weight, amount, count — relationship-specific metrics */
  metrics?: Record<string, number>;
  metadata?: Record<string, string | number | boolean>;
};

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  authored: "authored",
  maintains: "maintains",
  contributed_to: "contributed to",
  depends_on: "depends on",
  used_by: "used by",
  cited_by: "cited by",
  credited_to: "credited to",
  member_of: "member of",
  owns: "owns",
  funds: "funds",
  authorized_for: "authorized for",
  settled_to: "settled to",
  claimed_by: "claimed by",
  listened_to: "listened to",
  published: "published",
  moderates: "moderates",
  powers: "powers",
  downstream_of: "downstream of",
  upstream_of: "upstream of",
};

/** Infer common relationship types from observation kinds (Layer 3 → 4). */
export function defaultRelationshipForObservationKind(
  kind: string,
): RelationshipType | null {
  const map: Record<string, RelationshipType> = {
    code_contribution: "contributed_to",
    code_dependency: "depends_on",
    code_usage: "used_by",
    music_play: "listened_to",
    music_credit: "credited_to",
    research_citation: "cited_by",
    research_authorship: "authored",
    community_moderation: "moderates",
    treasury_allocation: "funds",
    authorization_created: "authorized_for",
    settlement_completed: "settled_to",
    claim_completed: "claimed_by",
  };
  return map[kind] ?? null;
}
