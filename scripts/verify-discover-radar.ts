/**
 * Graph metrics + discover radar smoke checks (no DB required for metrics).
 */
import {
  degreeCentralityScores,
  fundingEntropy,
  pageRankScores,
} from "../src/lib/graph/metrics";
import { layoutGraphNodes } from "../src/lib/discover/radar";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`OK: ${msg}`);
  }
}

const nodes = ["a", "b", "c"];
const edges = [
  { from: "a", to: "b", weight: 2 },
  { from: "b", to: "c", weight: 1 },
];

const deg = degreeCentralityScores(nodes, edges);
assert((deg.get("b") ?? 0) > (deg.get("a") ?? 0), "middle node higher degree in path");

const pr = pageRankScores(nodes, edges);
const prSum = [...pr.values()].reduce((s, v) => s + v, 0);
assert(prSum > 0.99 && prSum < 1.01, "page rank sums to ~1");

const ent = fundingEntropy([25, 25, 25, 25]);
assert(ent.entropy === 2, `equal split entropy = 2 (got ${ent.entropy})`);

const laid = layoutGraphNodes([
  { id: "x", label: "X", type: "creator", weight: 1 },
  { id: "y", label: "Y", type: "mission", weight: 1 },
]);
assert(laid[0].x != null && laid[0].y != null, "layout assigns coordinates");

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll discover radar lib checks passed");
