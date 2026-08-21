import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { paymentAuthorization: { findMany } },
}));

describe("getAgentResultsForSubjects", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("returns nothing when no rows match the requested subject", async () => {
    findMany.mockResolvedValue([]);
    const { getAgentResultsForSubjects } = await import(
      "@/lib/agent/result-by-subject"
    );
    const map = await getAgentResultsForSubjects("verified_work", ["work-1"]);
    expect(map.size).toBe(0);
  });

  it("attaches a persisted result only to the exact subject it was purchased for", async () => {
    findMany.mockResolvedValue([
      {
        payeeKey: "docs-review",
        createdAt: new Date("2026-08-19T00:00:00.000Z"),
        evidenceJson: JSON.stringify({
          raw: {
            result: { summary: "Docs quality: adequate" },
            context: { subjectType: "verified_work", subjectId: "work-1" },
          },
        }),
      },
      {
        payeeKey: "docs-review",
        createdAt: new Date("2026-08-19T00:05:00.000Z"),
        evidenceJson: JSON.stringify({
          raw: {
            result: { summary: "Docs quality: thin" },
            context: { subjectType: "verified_work", subjectId: "work-2" },
          },
        }),
      },
    ]);
    const { getAgentResultsForSubjects } = await import(
      "@/lib/agent/result-by-subject"
    );
    const map = await getAgentResultsForSubjects("verified_work", ["work-1"]);
    expect(map.size).toBe(1);
    expect(map.get("work-1")).toEqual([
      {
        serviceId: "docs-review",
        summary: "Docs quality: adequate",
        occurredAt: "2026-08-19T00:00:00.000Z",
      },
    ]);
    // work-2's result must never leak onto work-1's lookup.
    expect(map.get("work-2")).toBeUndefined();
  });

  it("ignores rows from a different subjectType even with a matching subjectId", async () => {
    findMany.mockResolvedValue([
      {
        payeeKey: "docs-review",
        createdAt: new Date(),
        evidenceJson: JSON.stringify({
          raw: {
            result: { summary: "Should not match" },
            context: { subjectType: "request", subjectId: "work-1" },
          },
        }),
      },
    ]);
    const { getAgentResultsForSubjects } = await import(
      "@/lib/agent/result-by-subject"
    );
    const map = await getAgentResultsForSubjects("verified_work", ["work-1"]);
    expect(map.size).toBe(0);
  });

  it("skips rows with no context (standalone Agent Marketplace purchases) without throwing", async () => {
    findMany.mockResolvedValue([
      {
        payeeKey: "docs-review",
        createdAt: new Date(),
        evidenceJson: JSON.stringify({ raw: { result: { summary: "x" }, url: "https://x" } }),
      },
      { payeeKey: "docs-review", createdAt: new Date(), evidenceJson: null },
      { payeeKey: "docs-review", createdAt: new Date(), evidenceJson: "not json" },
    ]);
    const { getAgentResultsForSubjects } = await import(
      "@/lib/agent/result-by-subject"
    );
    await expect(
      getAgentResultsForSubjects("verified_work", ["work-1"]),
    ).resolves.toEqual(new Map());
  });
});
