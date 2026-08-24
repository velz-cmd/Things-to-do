import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

/**
 * Phase 5 Release Slice 12: the required negative test (explicit user
 * instruction, Phase 5 section 21) - a race where a second payment attempt
 * arrives for a work reward that already has a confirmed or in-flight
 * payment. The server must reject/recompute, never trust a stale client
 * snapshot and double-pay. This reuses the already-built, already-tested
 * Slice 8 coverage loader as the server-side revalidation source, checked
 * before any new ActionRun is created - never inferred from the request
 * body's own claims.
 */

const {
  findUniqueActionRun,
  createActionRun,
  updateActionRun,
  findFirstPayoutDestination,
  findUniqueUser,
  loadCoverageBySourceId,
  sendIdentityUsdc,
} = vi.hoisted(() => ({
  findUniqueActionRun: vi.fn(),
  createActionRun: vi.fn(),
  updateActionRun: vi.fn(),
  findFirstPayoutDestination: vi.fn(),
  findUniqueUser: vi.fn(),
  loadCoverageBySourceId: vi.fn(),
  sendIdentityUsdc: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireReadyUser: vi.fn().mockResolvedValue({
    user: { id: "viewer-1" },
    profile: { id: "viewer-1", walletAddress: "0x1111111111111111111111111111111111111111" },
  }),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    actionRun: { findUnique: findUniqueActionRun, create: createActionRun, update: updateActionRun },
    payoutDestination: { findFirst: findFirstPayoutDestination },
    user: { findUnique: findUniqueUser },
  },
}));
vi.mock("@/lib/wallet/send-identity-usdc", () => ({ sendIdentityUsdc }));
vi.mock("@/lib/discover/verified-work-payment", () => ({
  resolvePayableVerifiedWork: vi.fn().mockResolvedValue({
    subjectId: "evidence-1",
    title: "Fix authentication bypass",
    repository: "example/repo",
    sourceUrl: "https://github.com/example/repo/commit/abc123",
    evidenceIds: [],
  }),
}));
vi.mock("@/lib/discover/marketplace/coverage-loader", () => ({
  loadCoverageBySourceId,
}));

const validBody = {
  recipientUserId: "recipient-1",
  amountUsd: 25,
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  fundingSource: "app" as const,
  purpose: "work_reward" as const,
  workSubjectId: "evidence-1",
};

function postRequest(body: Record<string, unknown> = validBody) {
  return new Request("http://localhost/api/wallet/send", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Release Slice 13: loadCoverageBySourceId() now returns a result object, not a bare Map. */
function coverageResult(
  records: Array<{ id: string; mechanism: string; amountUsd: number; purpose: string; status: string }>,
) {
  return {
    recordsBySourceId: new Map([["evidence-1", records]]),
    confirmedAvailability: "available" as const,
    pendingAvailability: "available" as const,
  };
}

describe("POST /api/wallet/send - server-side stale-state revalidation (Release Slice 12)", () => {
  beforeEach(() => {
    findUniqueActionRun.mockReset().mockResolvedValue(null);
    findFirstPayoutDestination.mockReset().mockResolvedValue({
      address: "0x2222222222222222222222222222222222222222",
      network: "ARC-TESTNET",
      asset: "USDC",
      verifiedAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    findUniqueUser.mockReset().mockResolvedValue({ displayName: "Recipient", githubUsername: null });
    loadCoverageBySourceId.mockReset().mockResolvedValue(coverageResult([]));
    createActionRun.mockReset().mockResolvedValue({ id: "run-new" });
    updateActionRun.mockReset().mockResolvedValue({});
    sendIdentityUsdc.mockReset().mockRejectedValue(new Error("Circle not configured in this test"));
  });

  it("rejects a second submission when the work reward already has a real confirmed payment - never trusts a stale client that thinks it's still unpaid", async () => {
    loadCoverageBySourceId.mockResolvedValue(
      coverageResult([{ id: "receipt-1", mechanism: "direct_support", amountUsd: 25, purpose: "p", status: "confirmed" }]),
    );
    const { POST } = await import("@/app/api/wallet/send/route");
    const response = await POST(postRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("work_reward_already_settled");
  });

  it("rejects a second submission racing a real transfer that is already in flight for the same work reward - the exact double-payment race named in the Phase 5 spec", async () => {
    loadCoverageBySourceId.mockResolvedValue(
      coverageResult([{ id: "run-1", mechanism: "direct_support", amountUsd: 25, purpose: "p", status: "pending" }]),
    );
    const { POST } = await import("@/app/api/wallet/send/route");
    const response = await POST(postRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("work_reward_settlement_in_progress");
  });

  it("checks server-persisted coverage, not any client-supplied state - the request body carries no coverage claim at all, yet the rejection still happens", async () => {
    loadCoverageBySourceId.mockResolvedValue(
      coverageResult([{ id: "run-1", mechanism: "direct_support", amountUsd: 25, purpose: "p", status: "pending" }]),
    );
    const { POST } = await import("@/app/api/wallet/send/route");
    const response = await POST(postRequest());
    expect(response.status).toBe(409);
    // The real server call was made with the real work subject id, proving
    // this was a genuine server-side lookup, not a pass-through of client input.
    expect(loadCoverageBySourceId).toHaveBeenCalledWith(["evidence-1"]);
  });

  it("does not block a genuinely unpaid, uncontested work reward - the check is real, not a blanket rejection", async () => {
    // Empty coverage records (the default beforeEach setup): no confirmed
    // or pending record exists for this work at all. The stale-state check
    // must let a genuine first submission continue past it - this test
    // proves it reaches real downstream processing (the mocked
    // sendIdentityUsdc is actually invoked) rather than the new check
    // itself becoming an overbroad false-positive block.
    const { POST } = await import("@/app/api/wallet/send/route");
    await POST(postRequest());
    expect(sendIdentityUsdc).toHaveBeenCalled();
  });

  it("Release Slice 13: fails closed (never open) when the confirmed-coverage query itself could not complete - a real DB failure must never read as 'verified: unpaid, safe to send'", async () => {
    loadCoverageBySourceId.mockResolvedValue({
      recordsBySourceId: new Map(),
      confirmedAvailability: "unavailable" as const,
      pendingAvailability: "available" as const,
    });
    const { POST } = await import("@/app/api/wallet/send/route");
    const response = await POST(postRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe("coverage_verification_unavailable");
    expect(body.retryable).toBe(true);
    expect(sendIdentityUsdc).not.toHaveBeenCalled();
    expect(createActionRun).not.toHaveBeenCalled();
  });

  it("Release Slice 13: fails closed when the pending-coverage query itself could not complete", async () => {
    loadCoverageBySourceId.mockResolvedValue({
      recordsBySourceId: new Map(),
      confirmedAvailability: "available" as const,
      pendingAvailability: "unavailable" as const,
    });
    const { POST } = await import("@/app/api/wallet/send/route");
    const response = await POST(postRequest());

    expect(response.status).toBe(503);
    expect(sendIdentityUsdc).not.toHaveBeenCalled();
    expect(createActionRun).not.toHaveBeenCalled();
  });

  /**
   * Phase 5 Release Slice 15: the required concurrency test (explicit user
   * instruction) - two requests for the same real obligation, racing past
   * the Slice 12 check-then-act coverage guard (which is not atomic on its
   * own), must still result in at most ONE reaching the money-send
   * boundary. The actual atomicity is a real database-level partial unique
   * index (migration 20260824151209_action_run_obligation_uniqueness,
   * ActionRun.obligationId, scoped to state IN ('submitting',
   * 'pending_external')) - this sandbox has no live Postgres to prove the
   * index itself fires (DATABASE_URL is unconfigured here, the same
   * external blocker already documented for the Phase 3 research schema
   * migration), so this test proves the half that IS testable without one:
   * the route correctly recognizes the real Prisma P2002 that Postgres
   * would raise on that unique-index violation, and turns the LOSING
   * request into a safe, honest "already in progress" response - never a
   * silent duplicate ActionRun, never a crash, never a false 200.
   */
  it("Release Slice 15: a concurrent request racing the same real obligation past the coverage check is rejected by the database-level constraint, not silently allowed to double-send", async () => {
    createActionRun.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`obligationId`)", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["obligationId"] },
      }),
    );
    const { POST } = await import("@/app/api/wallet/send/route");
    const response = await POST(postRequest());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("work_reward_settlement_in_progress");
    expect(sendIdentityUsdc).not.toHaveBeenCalled();
  });

  it("Release Slice 15: an unrelated unique-constraint conflict (the pre-existing idempotencyKey race) is still handled distinctly from an obligationId conflict", async () => {
    createActionRun.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`idempotencyKey`)", {
        code: "P2002",
        clientVersion: "6.19.3",
        meta: { target: ["idempotencyKey"] },
      }),
    );
    // First call is the pre-existing "existing" lookup (must be null so the
    // route proceeds to create); second call is the post-P2002 "raced"
    // lookup this test is actually about.
    findUniqueActionRun.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "raced-run" });
    const { POST } = await import("@/app/api/wallet/send/route");
    const response = await POST(postRequest());
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body.code).toBe("operation_in_progress");
    expect(body.code).not.toBe("work_reward_settlement_in_progress");
  });
});
