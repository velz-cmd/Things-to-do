import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    discoverOpportunity: {
      findMany: vi.fn(async () => []),
    },
  },
}));

import { prisma } from "@/lib/db";
import { loadPersistedOpportunities } from "@/lib/discover/marketplace/query";

const mockedFindMany = vi.mocked(prisma.discoverOpportunity.findMany);

/**
 * Invariant: the public "Open funded requests" feed - the shared market
 * every viewer sees, as opposed to "Your requests" - must never be scoped
 * to a particular viewer. A request from a completely different user must
 * be able to appear here for anyone. This is a structural check on the
 * actual query, not a screenshot of a snapshot that happened to be empty:
 * the WHERE clause must contain no creatorId/userId/selectedProviderId key
 * at all, only visibility/status/scheduling conditions.
 */
describe("loadPersistedOpportunities (public Requests feed)", () => {
  it("queries with no viewer-scoping field at all", async () => {
    await loadPersistedOpportunities();
    expect(mockedFindMany).toHaveBeenCalledTimes(1);
    const args = mockedFindMany.mock.calls[0][0];
    const whereJson = JSON.stringify(args?.where ?? {});
    expect(whereJson).not.toMatch(/creatorId|userId|selectedProviderId|ownerId/i);
    expect(args?.where).toMatchObject({ visibility: "public" });
  });
});
