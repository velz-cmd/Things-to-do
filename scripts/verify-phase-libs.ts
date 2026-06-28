/**
 * Unit smoke for phase libs — run: npx tsx scripts/verify-phase-libs.ts
 */
import { COMMUNITY_CATALOG, PROGRAM_TEMPLATES, listProgramTemplatesForKind } from "../src/lib/communities/catalog";
import { computePlatformFee, applyPlatformFeeSplit } from "../src/lib/payment/platform-fee";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  } else {
    console.log("OK:", msg);
  }
}

assert(COMMUNITY_CATALOG.length >= 5, "catalog has 5+ communities");
assert(Boolean(getCommunity("independent-music")), "independent-music in catalog");
assert(Object.keys(PROGRAM_TEMPLATES).length >= 5, "5+ program templates");
assert(listProgramTemplatesForKind("music").length >= 1, "music templates");
assert(listProgramTemplatesForKind("oss").length >= 1, "oss templates");
assert(listProgramTemplatesForKind("research").length >= 1, "research templates");

const fee = computePlatformFee(100);
assert(fee === 2.5, `platform fee on $100 = $2.5 (got ${fee})`);

const split = applyPlatformFeeSplit(100);
assert(split.netUsd === 97.5, `net after fee = 97.5 (got ${split.netUsd})`);
assert(split.feeUsd === 2.5, `fee = 2.5 (got ${split.feeUsd})`);

function getCommunity(slug: string) {
  return COMMUNITY_CATALOG.find((c) => c.slug === slug);
}

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll phase lib checks passed");
