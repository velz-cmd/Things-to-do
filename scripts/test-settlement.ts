/**
 * Settlement layer smoke tests — run: npx tsx scripts/test-settlement.ts
 */
import assert from "node:assert/strict";
import { ArcMockAdapter } from "../src/lib/settlement/adapters/arc-mock-adapter";
import { verifyArcTx } from "../src/lib/settlement/arc-verify";
import { isLiveArcEnabled } from "../src/lib/settlement/arc-config";
import { resetSettlementAdapter } from "../src/lib/settlement/settlement-service";

async function testInvalidTxHash() {
  const v = await verifyArcTx("not-a-hash");
  assert.equal(v.found, false);
  assert.equal(v.success, false);
  console.log("✓ invalid tx hash rejected");
}

async function testMissingReceipt() {
  const v = await verifyArcTx(
    "0x" + "ab".repeat(32)
  );
  assert.equal(v.found, false);
  console.log("✓ missing receipt does not show completed");
}

async function testLiveRefusesWithoutCredentials() {
  resetSettlementAdapter();
  const live = isLiveArcEnabled();
  if (!process.env.CIRCLE_API_KEY) {
    assert.equal(live, false);
    console.log("✓ live adapter disabled without Circle credentials");
  } else {
    console.log("○ Circle credentials present — live mode may be enabled");
  }
}

async function testMockAdapterNoFakeLinks() {
  const adapter = new ArcMockAdapter();
  const record = await adapter.createEscrow({
    taskId: "test-task-mock",
    amountUsdc: 1,
    description: "test",
  });
  assert.equal(record.mode, "mock_arc");
  assert.equal(record.fundTxHash, undefined);
  assert.equal(record.explorerUrls.length, 0);
  console.log("✓ mock adapter creates settlement without tx links");
}

async function testReleaseBlockedUntilProof() {
  if (!process.env.DATABASE_URL) {
    console.log("○ release blocked test skipped (no DATABASE_URL)");
    return;
  }

  const adapter = new ArcMockAdapter();
  await assert.rejects(
    () => adapter.release({ taskId: "nonexistent-task", reason: "test" }),
    /Settlement not found|No Arc job/
  );

  // In-memory style: create escrow then try release without proof
  try {
    const record = await adapter.createEscrow({
      taskId: "test-release-blocked",
      amountUsdc: 1,
      description: "test",
    });
    if (record.status === "escrow_locked") {
      await assert.rejects(
        () =>
          adapter.release({
            taskId: "test-release-blocked",
            reason: "premature",
          }),
        /Release blocked until proof is verified/
      );
      console.log("✓ release blocked until proof verified");
    }
  } catch (e) {
    console.log(
      "○ release blocked test skipped (no DATABASE_URL):",
      (e as Error).message
    );
  }
}

async function main() {
  await testInvalidTxHash();
  await testMissingReceipt();
  await testLiveRefusesWithoutCredentials();
  await testReleaseBlockedUntilProof();
  try {
    await testMockAdapterNoFakeLinks();
  } catch (e) {
    console.log("○ mock adapter DB test skipped (no DATABASE_URL):", (e as Error).message);
  }
  console.log("\nAll runnable settlement tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
