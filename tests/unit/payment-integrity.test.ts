import { describe, expect, it } from "vitest";
import { executeContributorBatch } from "../../src/lib/payment/execute";
import { executeAgentNanoPayments } from "../../src/lib/payment/nano";
import { isLiveArcEnabled } from "../../src/lib/settlement/arc-config";
import { PAYMENT_LAYER_BLUEPRINT } from "../../src/lib/payment/blueprint";

describe("financial execution integrity", () => {
  it("never turns an unavailable contributor transfer into an off-chain success", async () => {
    expect(isLiveArcEnabled()).toBe(false);
    const wallet = "0x1111111111111111111111111111111111111111";
    const result = await executeContributorBatch({
      settlementId: "settlement-1",
      missionId: "mission-1",
      proofHash: "a".repeat(64),
      batchNumber: 1,
      confidence: 0.9,
      treasuryAmount: 1,
      intents: [
        {
          id: "intent-1",
          wallet,
          weight: 1,
          amountUsd: 1,
          rank: 1,
          status: "pending",
        },
      ],
    });

    expect(result.intents[0]).toMatchObject({ status: "failed" });
    expect(result.intents[0]?.txHash).toBeUndefined();
    expect(result.failedWallets).toEqual([wallet]);
    expect(result.txHashes).toEqual([]);
    expect(result.explorerUrls).toEqual([]);
  });

  it("never invents nano-payment transaction hashes when Arc is disabled", async () => {
    expect(isLiveArcEnabled()).toBe(false);
    const records = await executeAgentNanoPayments({
      missionId: "mission-1",
      proofHash: "b".repeat(64),
      batchNumber: 1,
      agentsRun: ["identity_worker"],
    });

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((record) => record.status === "failed")).toBe(true);
    expect(records.every((record) => record.txHash === undefined)).toBe(true);
  });

  it("does not advertise the legacy synthetic escrow-lock endpoint", () => {
    expect(PAYMENT_LAYER_BLUEPRINT.apis).not.toHaveProperty("lockEscrow");
  });
});
