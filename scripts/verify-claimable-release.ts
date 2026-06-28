/**
 * Treasury claimable release policy checks (no DB required for import).
 */
import { getTreasurySnapshot } from "../src/lib/treasury/engine";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`OK: ${msg}`);
  }
}

async function main() {
  const snap = await getTreasurySnapshot();
  assert(typeof snap.balanceUsd === "number", "treasury snapshot returns balance");
  assert(typeof snap.obligationsUsd === "number", "treasury snapshot returns obligations");
  assert(snap.message.length > 0, "treasury snapshot has message");

  if (failed > 0) {
    console.error(`\n${failed} claimable release check(s) failed`);
    process.exit(1);
  }
  console.log("\nClaimable release checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
