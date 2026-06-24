import { PROOF_POLICIES } from "./types";
import { hashProofPayload } from "./state-machine";

export interface ProofInput {
  type: string;
  source: string;
  payload: Record<string, unknown>;
  category: string;
  targetValueUsd: number;
  artifactUrl?: string;
}

export interface ProofVerificationResult {
  verified: boolean;
  contentHash: string;
  reason: string;
  matchedPolicy?: string;
}

export function verifyProof(input: ProofInput): ProofVerificationResult {
  const contentHash = hashProofPayload(input.payload);
  const allowedTypes = PROOF_POLICIES[input.category] ?? PROOF_POLICIES.money_recovery;

  if (!allowedTypes.includes(input.type)) {
    return {
      verified: false,
      contentHash,
      reason: `Proof type "${input.type}" not in policy for ${input.category}`,
    };
  }

  if (input.category === "money_recovery") {
    const refunded = Number(input.payload.refundedAmountUsd ?? 0);
    if (refunded < input.targetValueUsd * 0.95) {
      return {
        verified: false,
        contentHash,
        reason: `Refund $${refunded} below 95% of target $${input.targetValueUsd}`,
        matchedPolicy: input.type,
      };
    }
  }

  if (input.category === "subscription") {
    const confirmed = input.payload.cancelled === true || input.type.includes("cancellation");
    if (!confirmed && !input.payload.confirmationId) {
      return {
        verified: false,
        contentHash,
        reason: "No cancellation confirmation in proof payload",
        matchedPolicy: input.type,
      };
    }
  }

  if (input.category === "bounty" || input.category === "contributor") {
    const merged =
      input.payload.merged === true ||
      input.payload.prMerged === true ||
      input.type.includes("pr_merged");
    const approved =
      input.payload.approved === true ||
      input.payload.deliverableApproved === true ||
      input.type.includes("deliverable_approved") ||
      input.type.includes("milestone_signed_off") ||
      input.type.includes("review_approved");

    if (!merged && !approved && !input.payload.confirmationId) {
      return {
        verified: false,
        contentHash,
        reason: "Bounty/contribution proof not confirmed",
        matchedPolicy: input.type,
      };
    }
  }

  if (input.category === "distribution") {
    const duration = Number(input.payload.durationSec ?? input.payload.duration ?? 0);
    const minDuration = input.type.includes("scrobble") ? 30 : 1;

    if (input.type.includes("scrobble") && duration > 0 && duration < minDuration) {
      return {
        verified: false,
        contentHash,
        reason: `Listen duration ${duration}s below ${minDuration}s floor`,
        matchedPolicy: input.type,
      };
    }

    if (input.payload.suspicious === true || input.payload.bot === true) {
      return {
        verified: false,
        contentHash,
        reason: "Event flagged as suspicious",
        matchedPolicy: input.type,
      };
    }

    if (input.payload.demoVerified === false) {
      return {
        verified: false,
        contentHash,
        reason: "Verification sample failed",
        matchedPolicy: input.type,
      };
    }
  }

  return {
    verified: true,
    contentHash,
    reason: "Proof matches outcome policy",
    matchedPolicy: input.type,
  };
}
