import test from "node:test";
import assert from "node:assert/strict";
import {
  ARC_NATIVE_GAS_DECIMALS,
  USDC_TOKEN_DECIMALS,
  formatArcNativeGasUnits,
  formatUsdcTokenUnits,
  parseArcNativeGasUnits,
  parseUsdcTokenUnits,
} from "../../src/lib/money/usdc";
import { deriveCommunityOperatingState } from "../../src/lib/communities/operating-state";
import { getCommunityNextBestAction } from "../../src/lib/communities/next-best-action";
import {
  RESOLVE_ACTION_IDS,
  actionRegistry,
} from "../../src/lib/actions/action-registry";
import { runWithFallbackResult } from "../../src/lib/providers/provider-router";
import { compileSettlementPackage, verifySettlementPackage } from "../../src/lib/settlement/settlement-package";
import { calculateRecognition } from "../../src/lib/outcomes/policy-engine";
import { outcomeAdapterRegistry } from "../../src/lib/outcomes/adapters/registry";
import { calculateIncrementalUnits, transitionCampaignRuntimeState } from "../../src/lib/outcomes/campaign-lifecycle";

const healthyFacts = {
  installed: true,
  sourceConnected: true,
  sourceHealthy: true,
  syncCompleted: true,
  programCount: 1,
  unresolvedIdentityCount: 0,
  obligationCount: 0,
  simulationComplete: false,
  fundingGapUsd: 0,
  settlementReady: false,
};

test("keeps Arc native gas and ERC-20 USDC units separate", () => {
  assert.equal(USDC_TOKEN_DECIMALS, 6);
  assert.equal(ARC_NATIVE_GAS_DECIMALS, 18);
  assert.equal(parseUsdcTokenUnits("1.25"), BigInt("1250000"));
  assert.equal(parseArcNativeGasUnits("1.25"), BigInt("1250000000000000000"));
  assert.equal(formatUsdcTokenUnits(BigInt("1250000")), "1.25");
  assert.equal(formatArcNativeGasUnits(BigInt("1250000000000000000")), "1.25");
});

test("derives community state in blocker order", () => {
  assert.equal(
    deriveCommunityOperatingState({ ...healthyFacts, installed: false }),
    "not_installed",
  );
  assert.equal(
    deriveCommunityOperatingState({ ...healthyFacts, sourceConnected: false }),
    "source_required",
  );
  assert.equal(
    deriveCommunityOperatingState({ ...healthyFacts, programCount: 0 }),
    "policy_required",
  );
  assert.equal(
    deriveCommunityOperatingState({ ...healthyFacts, unresolvedIdentityCount: 2 }),
    "identity_review",
  );
  assert.equal(
    deriveCommunityOperatingState({ ...healthyFacts, obligationCount: 3 }),
    "simulation_required",
  );
  assert.equal(
    deriveCommunityOperatingState({
      ...healthyFacts,
      obligationCount: 3,
      simulationComplete: true,
      fundingGapUsd: 10,
    }),
    "capital_required",
  );
});

test("maps operating state to one cross-tab next action", () => {
  const simulation = getCommunityNextBestAction({
    ...healthyFacts,
    obligationCount: 3,
  });
  assert.equal(simulation.actionId, "mission.simulate");
  assert.equal(simulation.destination, "mission");

  const settlement = getCommunityNextBestAction({
    ...healthyFacts,
    obligationCount: 3,
    simulationComplete: true,
    settlementReady: true,
  });
  assert.equal(settlement.actionId, "obligation.prepare_settlement");
  assert.equal(settlement.destination, "capital");
});

test("registers every declared product action with preconditions and recovery metadata", async () => {
  assert.equal(Object.keys(actionRegistry).length, RESOLVE_ACTION_IDS.length);
  for (const id of RESOLVE_ACTION_IDS) {
    const action = actionRegistry[id];
    assert.equal(action.id, id);
    assert.equal(typeof action.getPreconditions, "function");
    assert.equal(typeof action.getOptimisticPatch, "function");
    const precondition = await action.getPreconditions(undefined, {
      userId: action.requiresAuth ? null : "public",
      role: "user",
      correlationId: "test",
      idempotencyKey: `test:${id}`,
    });
    if (action.requiresAuth) {
      assert.equal(precondition.allowed, false);
      assert.ok(precondition.reason);
    }
  }
});

test("provider router returns cached last-known state with provenance", async () => {
  const live = await runWithFallbackResult({
    feature: "test-provider",
    cacheKey: "test-provider-key",
    providers: [{ name: "primary", run: async () => ({ value: 7 }) }],
    fallback: { value: 0 },
  });
  assert.equal(live.source, "provider");
  assert.deepEqual(live.value, { value: 7 });

  const cached = await runWithFallbackResult({
    feature: "test-provider",
    cacheKey: "test-provider-key",
    providers: [{ name: "primary", run: async () => Promise.reject(new Error("offline")) }],
    fallback: { value: 0 },
  });
  assert.equal(cached.source, "cache");
  assert.equal(cached.stale, true);
  assert.deepEqual(cached.value, { value: 7 });
});

test("settlement package hashing is canonical and amount-exact", () => {
  const base = {
    communityId: "independent-music",
    programId: "program-1",
    programVersionId: "program-version-2",
    policyVersionId: "policy-version-3",
    evidenceContentHashes: ["evidence-b", "evidence-a"],
    simulationId: "simulation-1",
    preparedAt: "2026-07-13T12:00:00.000Z",
  };
  const first = compileSettlementPackage({
    ...base,
    payees: [
      { obligationId: "obligation-b", identityId: "identity-b", payoutDestinationId: "payout-b", address: "0x0000000000000000000000000000000000000002", amountUsdcMicro: "200000", evidenceIds: ["evidence-b"] },
      { obligationId: "obligation-a", identityId: "identity-a", payoutDestinationId: "payout-a", address: "0x0000000000000000000000000000000000000001", amountUsdcMicro: "100001", evidenceIds: ["evidence-a"] },
    ],
  });
  const reordered = compileSettlementPackage({ ...base, evidenceContentHashes: [...base.evidenceContentHashes].reverse(), payees: [...first.package.payees].reverse() });
  assert.equal(first.package.totalUsdcMicro, "300001");
  assert.equal(first.packageHash, reordered.packageHash);
  assert.equal(verifySettlementPackage(first.package, first.packageHash), true);
  assert.equal(verifySettlementPackage({ ...first.package, totalUsdcMicro: "300000" }, first.packageHash), false);
});

test("outcome recognition is deterministic and respects every monetary cap", () => {
  const result = calculateRecognition({
    formula: { mode: "hybrid", approvedBaseMicroUsdc: 2_000_000n, rateMicroUsdc: 1_000n, maximumMicroUsdc: 25_000_000n },
    verifiedUnits: 10_000n,
    approved: true,
    participantCapMicroUsdc: 9_000_000n,
    campaignRemainingMicroUsdc: 7_500_000n,
  });
  assert.equal(result.amountMicroUsdc, 7_500_000n);
});

test("only PeerTube is labelled live for creator traction", () => {
  assert.equal(outcomeAdapterRegistry.peertube.status, "live");
  assert.equal(outcomeAdapterRegistry.youtube.status, "configuration_required");
  assert.equal(outcomeAdapterRegistry.owncast.status, "configuration_required");
  assert.equal(outcomeAdapterRegistry.rss.status, "planned");
});

test("campaign runtime transitions preserve closed-state finality", () => {
  assert.equal(transitionCampaignRuntimeState("active", "pause"), "paused");
  assert.equal(transitionCampaignRuntimeState("paused", "resume"), "active");
  assert.equal(transitionCampaignRuntimeState("active", "close"), "closed");
  assert.equal(transitionCampaignRuntimeState("closed", "resume"), null);
  assert.equal(transitionCampaignRuntimeState("funding_required", "pause"), null);
});

test("outcome synchronization recognizes only growth since the latest snapshot", () => {
  assert.equal(calculateIncrementalUnits(BigInt(15), BigInt(10)), BigInt(5));
  assert.equal(calculateIncrementalUnits(BigInt(15), BigInt(15)), BigInt(0));
  assert.equal(calculateIncrementalUnits(BigInt(10), BigInt(15)), BigInt(0));
});
