import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw, findMany } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: queryRaw,
    actionRun: { findMany },
  },
}));

describe("loadCoverageBySourceId - real confirmed/pending coverage, batch-loaded", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    queryRaw.mockReset().mockResolvedValue([]);
    findMany.mockReset().mockResolvedValue([]);
    process.env.DATABASE_URL = "postgresql://test";
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("returns an empty, fully-available result without querying when no source ids are given", async () => {
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId([]);
    expect(result.recordsBySourceId.size).toBe(0);
    expect(result.confirmedAvailability).toBe("available");
    expect(result.pendingAvailability).toBe("available");
    expect(queryRaw).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns an empty, fully-available result without querying when no database is configured - never claims coverage exists on a guess", async () => {
    delete process.env.DATABASE_URL;
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["work-1"]);
    expect(result.recordsBySourceId.size).toBe(0);
    expect(result.confirmedAvailability).toBe("available");
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("maps a real confirmed work-reward receipt to its exact canonical work subject id", async () => {
    queryRaw.mockResolvedValueOnce([
      {
        work_subject_id: "evidence-1",
        work_title: "Fix authentication bypass",
        amount_micro_usdc: 20_000_000n,
        public_reference: "work_abc123",
        tx_hash: "0xdeadbeef",
      },
    ]);
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1"]);
    const records = result.recordsBySourceId.get("evidence-1");
    expect(records).toHaveLength(1);
    expect(records?.[0]).toMatchObject({
      mechanism: "direct_support",
      amountUsd: 20,
      purpose: "Fix authentication bypass",
      status: "confirmed",
      receiptReference: "0xdeadbeef",
    });
  });

  it("Release Slice 14: a real persisted obligationId (from Receipt.payload) is read and returned, making exact-obligation duplicate detection possible", async () => {
    queryRaw.mockResolvedValueOnce([
      {
        work_subject_id: "evidence-1",
        work_title: "Fix authentication bypass",
        amount_micro_usdc: 20_000_000n,
        public_reference: "work_abc123",
        tx_hash: "0xdeadbeef",
        obligation_id: "obl-real-hash-abc",
      },
    ]);
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1"]);
    expect(result.recordsBySourceId.get("evidence-1")?.[0]?.obligationId).toBe("obl-real-hash-abc");
  });

  it("Release Slice 14: a legacy confirmed receipt with no persisted obligationId leaves it undefined - never invented", async () => {
    queryRaw.mockResolvedValueOnce([
      {
        work_subject_id: "evidence-1",
        work_title: "Fix authentication bypass",
        amount_micro_usdc: 20_000_000n,
        public_reference: "work_abc123",
        tx_hash: "0xdeadbeef",
        obligation_id: null,
      },
    ]);
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1"]);
    expect(result.recordsBySourceId.get("evidence-1")?.[0]?.obligationId).toBeUndefined();
  });

  it("Release Slice 14: a real persisted obligationId on a pending ActionRun (from input.obligationId) is read and returned", async () => {
    findMany.mockResolvedValueOnce([
      {
        id: "run-1",
        aggregateId: "evidence-1",
        input: { amountUsd: 15, workTitle: "Fix authentication bypass", obligationId: "obl-real-hash-abc" },
      },
    ]);
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1"]);
    expect(result.recordsBySourceId.get("evidence-1")?.[0]?.obligationId).toBe("obl-real-hash-abc");
  });

  it("an unrelated work subject id never receives coverage meant for a different work", async () => {
    queryRaw.mockResolvedValueOnce([
      {
        work_subject_id: "evidence-1",
        work_title: "Fix authentication bypass",
        amount_micro_usdc: 20_000_000n,
        public_reference: "work_abc123",
        tx_hash: "0xdeadbeef",
      },
    ]);
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1", "evidence-2"]);
    expect(result.recordsBySourceId.get("evidence-2")).toBeUndefined();
  });

  it("a pending (in-flight) work-reward payment is real coverage, but marked pending, never confirmed - and carries the real persisted work title", async () => {
    findMany.mockResolvedValueOnce([
      {
        id: "run-1",
        aggregateId: "evidence-1",
        input: { amountUsd: 15, workSubjectId: "evidence-1", workTitle: "Fix authentication bypass" },
      },
    ]);
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1"]);
    const records = result.recordsBySourceId.get("evidence-1");
    expect(records).toHaveLength(1);
    expect(records?.[0]).toMatchObject({
      amountUsd: 15,
      status: "pending",
      purpose: "Fix authentication bypass",
    });
  });

  it("a legacy pending ActionRun written before purpose was persisted falls back to an honestly-labeled unknown purpose, never a fabricated exact match", async () => {
    findMany.mockResolvedValueOnce([
      { id: "run-1", aggregateId: "evidence-1", input: { amountUsd: 15, workSubjectId: "evidence-1" } },
    ]);
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1"]);
    const records = result.recordsBySourceId.get("evidence-1");
    expect(records?.[0]?.purpose).toBe("unknown/legacy purpose (submitted before purpose was persisted)");
  });

  it("a pending ActionRun with no numeric amountUsd is skipped rather than guessed", async () => {
    findMany.mockResolvedValueOnce([
      { id: "run-1", aggregateId: "evidence-1", input: { workSubjectId: "evidence-1" } },
    ]);
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1"]);
    expect(result.recordsBySourceId.get("evidence-1")).toBeUndefined();
  });

  it("confirmed and pending coverage for the same work subject both appear, kept separate by status", async () => {
    queryRaw.mockResolvedValueOnce([
      {
        work_subject_id: "evidence-1",
        work_title: "Fix authentication bypass",
        amount_micro_usdc: 20_000_000n,
        public_reference: "work_abc123",
        tx_hash: "0xdeadbeef",
      },
    ]);
    findMany.mockResolvedValueOnce([
      { id: "run-1", aggregateId: "evidence-1", input: { amountUsd: 15 } },
    ]);
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1"]);
    const records = result.recordsBySourceId.get("evidence-1");
    expect(records).toHaveLength(2);
    expect(records?.map((r) => r.status).sort()).toEqual(["confirmed", "pending"]);
  });

  it("a real DB failure on the confirmed query is reported as unavailable, not silently empty", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connection reset"));
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1"]);
    expect(result.confirmedAvailability).toBe("unavailable");
    expect(result.pendingAvailability).toBe("available");
  });

  it("a real DB failure on the pending query is reported as unavailable, not silently empty", async () => {
    findMany.mockRejectedValueOnce(new Error("connection reset"));
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1"]);
    expect(result.pendingAvailability).toBe("unavailable");
    expect(result.confirmedAvailability).toBe("available");
  });

  it("Release Slice 13: a confirmed-query failure does NOT delete pending records that genuinely loaded - independent failure semantics, not a shared catch that wipes both", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connection reset"));
    findMany.mockResolvedValueOnce([
      { id: "run-1", aggregateId: "evidence-1", input: { amountUsd: 15, workTitle: "Fix authentication bypass" } },
    ]);
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1"]);
    expect(result.confirmedAvailability).toBe("unavailable");
    expect(result.pendingAvailability).toBe("available");
    expect(result.recordsBySourceId.get("evidence-1")).toHaveLength(1);
    expect(result.recordsBySourceId.get("evidence-1")?.[0]?.status).toBe("pending");
  });

  it("Release Slice 13: a pending-query failure does NOT delete confirmed records that genuinely loaded", async () => {
    queryRaw.mockResolvedValueOnce([
      {
        work_subject_id: "evidence-1",
        work_title: "Fix authentication bypass",
        amount_micro_usdc: 20_000_000n,
        public_reference: "work_abc123",
        tx_hash: "0xdeadbeef",
      },
    ]);
    findMany.mockRejectedValueOnce(new Error("connection reset"));
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const result = await loadCoverageBySourceId(["evidence-1"]);
    expect(result.pendingAvailability).toBe("unavailable");
    expect(result.confirmedAvailability).toBe("available");
    expect(result.recordsBySourceId.get("evidence-1")).toHaveLength(1);
    expect(result.recordsBySourceId.get("evidence-1")?.[0]?.status).toBe("confirmed");
  });

  it("deduplicates repeated source ids before querying", async () => {
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    await loadCoverageBySourceId(["evidence-1", "evidence-1", "evidence-1"]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ aggregateId: { in: ["evidence-1"] } }),
      }),
    );
  });
});
