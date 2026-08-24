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

  it("returns an empty map without querying when no source ids are given", async () => {
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const map = await loadCoverageBySourceId([]);
    expect(map.size).toBe(0);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns an empty map without querying when no database is configured - never claims coverage exists on a guess", async () => {
    delete process.env.DATABASE_URL;
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const map = await loadCoverageBySourceId(["work-1"]);
    expect(map.size).toBe(0);
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
    const map = await loadCoverageBySourceId(["evidence-1"]);
    const records = map.get("evidence-1");
    expect(records).toHaveLength(1);
    expect(records?.[0]).toMatchObject({
      mechanism: "direct_support",
      amountUsd: 20,
      purpose: "Fix authentication bypass",
      status: "confirmed",
      receiptReference: "0xdeadbeef",
    });
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
    const map = await loadCoverageBySourceId(["evidence-1", "evidence-2"]);
    expect(map.get("evidence-2")).toBeUndefined();
  });

  it("a pending (in-flight) work-reward payment is real coverage, but marked pending, never confirmed", async () => {
    findMany.mockResolvedValueOnce([
      {
        id: "run-1",
        aggregateId: "evidence-1",
        input: { amountUsd: 15, workSubjectId: "evidence-1" },
      },
    ]);
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const map = await loadCoverageBySourceId(["evidence-1"]);
    const records = map.get("evidence-1");
    expect(records).toHaveLength(1);
    expect(records?.[0]).toMatchObject({ amountUsd: 15, status: "pending" });
  });

  it("a pending ActionRun with no numeric amountUsd is skipped rather than guessed", async () => {
    findMany.mockResolvedValueOnce([
      { id: "run-1", aggregateId: "evidence-1", input: { workSubjectId: "evidence-1" } },
    ]);
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const map = await loadCoverageBySourceId(["evidence-1"]);
    expect(map.get("evidence-1")).toBeUndefined();
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
    const map = await loadCoverageBySourceId(["evidence-1"]);
    const records = map.get("evidence-1");
    expect(records).toHaveLength(2);
    expect(records?.map((r) => r.status).sort()).toEqual(["confirmed", "pending"]);
  });

  it("a real DB failure degrades to an empty map rather than throwing and breaking the whole page", async () => {
    queryRaw.mockRejectedValueOnce(new Error("connection reset"));
    const { loadCoverageBySourceId } = await import(
      "@/lib/discover/marketplace/coverage-loader"
    );
    const map = await loadCoverageBySourceId(["evidence-1"]);
    expect(map.size).toBe(0);
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
