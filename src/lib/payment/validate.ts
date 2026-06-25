import { createHash } from "crypto";
import type { MissionSettlementInput } from "@/lib/payment/types";
import { AUTO_SETTLE_CONFIDENCE_MIN } from "@/lib/payment/types";

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export function validateSettlementPackage(
  input: MissionSettlementInput,
  existingProofHashes: string[],
): ValidationResult {
  if (!input.missionId?.trim()) {
    return { ok: false, code: "MISSING_MISSION", message: "missionId required" };
  }
  if (!input.proofHash?.trim()) {
    return { ok: false, code: "MISSING_PROOF", message: "proofHash required — must originate from Intelligence Layer" };
  }
  if (input.confidence < AUTO_SETTLE_CONFIDENCE_MIN) {
    return {
      ok: false,
      code: "LOW_CONFIDENCE",
      message: `confidence ${input.confidence} below threshold ${AUTO_SETTLE_CONFIDENCE_MIN}`,
    };
  }
  if (!input.contributors?.length) {
    return { ok: false, code: "NO_CONTRIBUTORS", message: "contributors array empty" };
  }

  const treasury = Number(input.treasuryAmount);
  if (!Number.isFinite(treasury) || treasury <= 0) {
    return { ok: false, code: "INVALID_TREASURY", message: "treasuryAmount must be positive" };
  }

  const wallets = new Set<string>();
  let sum = 0;
  for (const c of input.contributors) {
    if (!c.wallet?.match(/^0x[a-fA-F0-9]{40}$/)) {
      return { ok: false, code: "INVALID_WALLET", message: `Invalid wallet for ${c.login ?? "contributor"}` };
    }
    const w = c.wallet.toLowerCase();
    if (wallets.has(w)) {
      return { ok: false, code: "DUPLICATE_WALLET", message: `Duplicate wallet ${c.wallet}` };
    }
    wallets.add(w);
    const amt = Number(c.amount);
    if (!Number.isFinite(amt) || amt < 0) {
      return { ok: false, code: "INVALID_AMOUNT", message: `Invalid amount for ${c.wallet}` };
    }
    sum += amt;
  }

  const tolerance = 0.02;
  if (Math.abs(sum - treasury) > tolerance) {
    return {
      ok: false,
      code: "SUM_MISMATCH",
      message: `Contributor sum $${sum.toFixed(2)} ≠ treasury $${treasury.toFixed(2)}`,
    };
  }

  if (existingProofHashes.includes(input.proofHash)) {
    return { ok: false, code: "DUPLICATE_SETTLEMENT", message: "proofHash already settled" };
  }

  return { ok: true };
}

export function settlementAuditHash(input: MissionSettlementInput): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        missionId: input.missionId,
        proofHash: input.proofHash,
        treasury: input.treasuryAmount,
        contributors: input.contributors.map((c) => ({
          wallet: c.wallet.toLowerCase(),
          amount: c.amount,
          weight: c.weight,
        })),
      }),
    )
    .digest("hex");
}
