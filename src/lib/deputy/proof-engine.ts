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

  return {
    verified: true,
    contentHash,
    reason: "Proof matches outcome policy",
    matchedPolicy: input.type,
  };
}
