/**
 * Phase 5 power + polish checks.
 */
import { COMMAND_ITEMS, filterCommands } from "../src/lib/command/registry";
import { PRODUCT_NAV, LEGACY_REDIRECTS } from "../src/components/resolve/layout/nav";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`OK: ${msg}`);
  }
}

assert(PRODUCT_NAV.length === 5, "five primary tabs in PRODUCT_NAV");
assert(!PRODUCT_NAV.some((n) => n.href === "/network"), "no Network tab");
assert(LEGACY_REDIRECTS["/network"] === "/discover", "network redirects to discover");
assert(LEGACY_REDIRECTS["/connectors"] === "/settings", "connectors admin → settings");

assert(COMMAND_ITEMS.length >= 10, "command registry populated");
assert(
  COMMAND_ITEMS.some((c) => c.id === "nav-settings"),
  "settings in command palette",
);
assert(filterCommands("capital").some((c) => c.href === "/capital"), "command search finds capital");
assert(
  filterCommands("maintainers").some((c) => c.mission?.includes("maintainers")),
  "mission commands searchable",
);

if (failed > 0) {
  console.error(`\n${failed} phase 5 check(s) failed`);
  process.exit(1);
}

console.log("\nAll phase 5 checks passed");
