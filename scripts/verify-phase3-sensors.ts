/**
 * Phase 3 sensor pipeline smoke checks (no DB / network required for core logic).
 */
import { bayesianPayeeConfidence } from "../src/lib/sensors/confidence";
import { isDocumentationPr } from "../src/lib/sensors/github-docs";
import { observationsToSettlementEvents } from "../src/lib/sensors/pipeline";
import { listBrowsableCommunities } from "../src/lib/sensors/catalog-visibility";
import type { Observation } from "../src/lib/domain/observation";
import type { SensorProgramContext } from "../src/lib/sensors/program-context";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`OK: ${msg}`);
  }
}

const docsPr = {
  number: 42,
  title: "Update README and docs guide",
  author: "alice",
  authorId: 1,
  state: "closed",
  merged: true,
  mergedAt: "2026-01-15T00:00:00.000Z",
  additions: 80,
  deletions: 10,
  changedFiles: 3,
  reviewComments: 2,
  commits: 2,
  labels: ["documentation"],
  files: [{ path: "docs/guide.md", additions: 50, deletions: 5 }],
};

assert(isDocumentationPr(docsPr), "detects documentation PR");

const bayes = bayesianPayeeConfidence({
  sensorQuality: 0.9,
  proofStrength: 0.85,
  corroboration: 0.8,
});
assert(bayes.confidence > 0.7, "bayesian confidence > 0.7 for strong evidence");

const program: SensorProgramContext = {
  missionId: "test-mission",
  communitySlug: "react",
  templateId: "docs-bounty",
  rules: { perMergeUsd: 25 },
};

const obs: Observation = {
  id: "github:docs:test:pr-1",
  idempotencyKey: "github:docs:test:pr-1",
  connectorId: "github",
  kind: "code_contribution",
  observedAt: new Date().toISOString(),
  actor: { type: "person", id: "person:github:alice", label: "alice" },
  subject: { type: "repository", id: "repo:test/repo", label: "test/repo" },
  metrics: { amount_hint_usd: 25 },
  confidence: 0.85,
  proofHash: "abc123",
  evidenceRefs: ["pr-1"],
  missionId: program.missionId,
  policyId: program.templateId,
};

const events = observationsToSettlementEvents([obs], program);
assert(events.length === 1, "observation → authorization event");
assert(events[0].eventType === "docs.merged", "docs event type");
assert(events[0].amountUsd === 25, "policy amount applied");

const browseAllLive = listBrowsableCommunities([
  { slug: "react", sensorGated: true, sensorLive: true, sensorReady: true, message: "" },
  { slug: "linux", sensorGated: true, sensorLive: false, sensorReady: true, message: "" },
  { slug: "independent-music", sensorGated: false, sensorLive: true, sensorReady: true, message: "" },
]);
assert(browseAllLive.some((c) => c.slug === "react"), "react visible when sensor live");
assert(!browseAllLive.some((c) => c.slug === "linux"), "linux hidden until sensor live");
assert(browseAllLive.some((c) => c.slug === "independent-music"), "music always visible");

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll phase 3 sensor checks passed");
