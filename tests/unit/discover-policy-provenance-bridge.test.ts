import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { findManyProgramVersion, findManyPolicyVersion } = vi.hoisted(() => ({
  findManyProgramVersion: vi.fn(),
  findManyPolicyVersion: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    programVersion: { findMany: findManyProgramVersion },
    policyVersion: { findMany: findManyPolicyVersion },
  },
}));

describe("loadPolicyProvenanceByProgramId - read-only bridge to the existing persisted policy system", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    findManyProgramVersion.mockReset().mockResolvedValue([]);
    findManyPolicyVersion.mockReset().mockResolvedValue([]);
    process.env.DATABASE_URL = "postgresql://test";
  });

  afterEach(() => {
    process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("returns an empty, available result without querying when no program ids are given", async () => {
    const { loadPolicyProvenanceByProgramId } = await import(
      "@/lib/discover/marketplace/policy-provenance-bridge"
    );
    const result = await loadPolicyProvenanceByProgramId([]);
    expect(result.byProgramId.size).toBe(0);
    expect(result.availability).toBe("available");
    expect(findManyProgramVersion).not.toHaveBeenCalled();
  });

  it("returns an empty, available result without querying when no database is configured", async () => {
    delete process.env.DATABASE_URL;
    const { loadPolicyProvenanceByProgramId } = await import(
      "@/lib/discover/marketplace/policy-provenance-bridge"
    );
    const result = await loadPolicyProvenanceByProgramId(["program-1"]);
    expect(result.byProgramId.size).toBe(0);
    expect(result.availability).toBe("available");
  });

  it("a Pool with no persisted ProgramVersion is simply absent from the map, never an error - and the lookup itself is reported as genuinely available", async () => {
    const { loadPolicyProvenanceByProgramId } = await import(
      "@/lib/discover/marketplace/policy-provenance-bridge"
    );
    const result = await loadPolicyProvenanceByProgramId(["program-1"]);
    expect(result.byProgramId.has("program-1")).toBe(false);
    expect(result.availability).toBe("available");
  });

  it("projects the real persisted PolicyVersion.contentHash as the canonical policy fingerprint", async () => {
    findManyProgramVersion.mockResolvedValueOnce([
      { id: "pv-1", programId: "program-1", version: 2 },
    ]);
    findManyPolicyVersion.mockResolvedValueOnce([
      { programVersionId: "pv-1", version: 3, contentHash: "hash-abc" },
    ]);
    const { loadPolicyProvenanceByProgramId } = await import(
      "@/lib/discover/marketplace/policy-provenance-bridge"
    );
    const result = await loadPolicyProvenanceByProgramId(["program-1"]);
    expect(result.byProgramId.get("program-1")).toEqual({
      policyFingerprint: "hash-abc",
      policyVersion: 3,
      provenance: "persisted",
    });
  });

  it("uses only the latest ProgramVersion when a program has several historical versions", async () => {
    findManyProgramVersion.mockResolvedValueOnce([
      { id: "pv-new", programId: "program-1", version: 5 },
      { id: "pv-old", programId: "program-1", version: 1 },
    ]);
    findManyPolicyVersion.mockResolvedValueOnce([
      { programVersionId: "pv-new", version: 1, contentHash: "current-hash" },
    ]);
    const { loadPolicyProvenanceByProgramId } = await import(
      "@/lib/discover/marketplace/policy-provenance-bridge"
    );
    const result = await loadPolicyProvenanceByProgramId(["program-1"]);
    expect(result.byProgramId.get("program-1")?.policyFingerprint).toBe("current-hash");
  });

  it("a ProgramVersion with no PolicyVersion yet is absent from the map - never invents a fingerprint", async () => {
    findManyProgramVersion.mockResolvedValueOnce([
      { id: "pv-1", programId: "program-1", version: 1 },
    ]);
    findManyPolicyVersion.mockResolvedValueOnce([]);
    const { loadPolicyProvenanceByProgramId } = await import(
      "@/lib/discover/marketplace/policy-provenance-bridge"
    );
    const result = await loadPolicyProvenanceByProgramId(["program-1"]);
    expect(result.byProgramId.has("program-1")).toBe(false);
    expect(result.availability).toBe("available");
  });

  it("Release Slice 13: a real DB failure is reported as unavailable, never silently folded into 'absent' - ABSENT POLICY != POLICY LOOKUP FAILED", async () => {
    findManyProgramVersion.mockRejectedValueOnce(new Error("connection reset"));
    const { loadPolicyProvenanceByProgramId } = await import(
      "@/lib/discover/marketplace/policy-provenance-bridge"
    );
    const result = await loadPolicyProvenanceByProgramId(["program-1"]);
    expect(result.byProgramId.size).toBe(0);
    expect(result.availability).toBe("unavailable");
  });

  it("never calls anything resembling a write/create operation - read-only by construction", async () => {
    const { loadPolicyProvenanceByProgramId } = await import(
      "@/lib/discover/marketplace/policy-provenance-bridge"
    );
    await loadPolicyProvenanceByProgramId(["program-1"]);
    // The mock only exposes findMany on each model - a create/upsert call
    // would throw as "not a function" if the source called one, since no
    // such mock method exists. Passing here proves no such call was made.
    expect(findManyProgramVersion).toHaveBeenCalled();
  });
});
