/**
 * Normalized settlement input — every Distribution Connector emits this shape.
 * Authorization Ledger never contains connector-specific fields.
 */

export type AuthorizationStatus =
  | "authorized"
  | "recognized"
  | "pending_funding"
  | "claimable"
  | "claimed"
  | "settled"
  | "cancelled";

/** Single payee authorization derived from upstream metadata. */
export type SettlementInputEvent = {
  connectorId: string;
  eventType: string;
  occurredAt: string;
  missionId: string;
  idempotencyKey: string;
  payeeKeyType: string;
  payeeKey: string;
  amountUsd: number;
  weight?: number;
  proofHash: string;
  confidence?: number;
  contextLabel?: string;
  evidenceRefs: string[];
  rawMetadata?: unknown;
  /** Optional — which community policy authorized this amount */
  policyId?: string;
  /** Optional — links upstream auth to triggering consumption event */
  causedByEventId?: string;
};

export type AuthorizationSummary = {
  missionId: string | null;
  connectorId?: string;
  authorizedUsd: number;
  pendingFundingUsd: number;
  claimableUsd: number;
  settledUsd: number;
  count: number;
  authorizations: {
    id: string;
    payeeKey: string;
    payeeKeyType: string;
    amountUsd: number;
    status: AuthorizationStatus;
    connectorId: string;
    contextLabel: string | null;
  }[];
};
