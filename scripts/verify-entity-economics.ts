/**
 * Entity economics + path smoke checks (no DB required).
 */
import {
  conservationFlow,
  giniCoefficient,
  hIndexStyle,
} from "../src/lib/entity/economics";
import {
  entityIdToPath,
  entityPathToId,
  payeeToEntityId,
} from "../src/lib/entity/paths";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`OK: ${msg}`);
  }
}

const repoId = "repo:vercel/next.js";
const repoPath = entityIdToPath(repoId);
assert(repoPath === "/e/repo/vercel/next.js", "repo id → path");
assert(entityPathToId(["repo", "vercel", "next.js"]) === repoId, "repo path → id");

const artistId = payeeToEntityId("Björk", "listen_artist");
assert(artistId === "creator:björk", "listen artist → creator id");
assert(entityIdToPath(artistId) === "/e/artist/bj%C3%B6rk", "artist path encodes");

const maintId = payeeToEntityId("octocat", "github_username");
assert(maintId === "person:github:octocat", "github user → person id");
assert(
  entityPathToId(["maintainer", "github", "octocat"]) === maintId,
  "maintainer path → id",
);

const flow = conservationFlow({
  inflowsUsd: 100,
  treasuryUsd: 40,
  settledUsd: 30,
  pendingUsd: 30,
});
assert(flow.balanced, "conservation flow balances");

const gini = giniCoefficient([10, 10, 10, 10]);
assert(gini.coefficient === 0, "equal split gini = 0");

const h = hIndexStyle([5, 4, 3, 1]);
assert(h.hIndex === 3, `h-index = 3 (got ${h.hIndex})`);

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll entity lib checks passed");
