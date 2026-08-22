import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchCollectiveContributions, isOpenCollectiveConfigured } = vi.hoisted(() => ({
  fetchCollectiveContributions: vi.fn(),
  isOpenCollectiveConfigured: vi.fn(),
}));

vi.mock("@/lib/integrations/opencollective", () => ({
  fetchCollectiveContributions,
  isOpenCollectiveConfigured,
}));

describe("loadCommunityFundingSignals", () => {
  beforeEach(() => {
    fetchCollectiveContributions.mockReset();
    isOpenCollectiveConfigured.mockReset();
  });

  it("returns nothing when Open Collective isn't configured, rather than inventing signals", async () => {
    isOpenCollectiveConfigured.mockReturnValue(false);
    const { loadCommunityFundingSignals } = await import(
      "@/lib/discover/marketplace/community-funding-source"
    );
    const result = await loadCommunityFundingSignals();
    expect(result).toEqual([]);
    expect(fetchCollectiveContributions).not.toHaveBeenCalled();
  });

  it("normalizes a real contribution into a confirmed, already-funded marketplace item", async () => {
    isOpenCollectiveConfigured.mockReturnValue(true);
    fetchCollectiveContributions.mockResolvedValue([
      {
        id: "tx-1",
        amountUsd: 25,
        createdAt: "2026-08-01T12:00:00.000Z",
        contributorSlug: "jane-doe",
        contributorName: "Jane Doe",
        recipientSlug: "resolve",
        recipientName: "RESOLVE",
      },
    ]);
    const { loadCommunityFundingSignals } = await import(
      "@/lib/discover/marketplace/community-funding-source"
    );
    const [item] = await loadCommunityFundingSignals();

    expect(item.source).toEqual({ type: "open_collective_contribution", id: "tx-1" });
    expect(item.marketplaceKind).toBe("verified_work");
    expect(item.funding).toMatchObject({ fundedAmountUsd: 25, status: "funded", amountState: "confirmed" });
    expect(item.verificationStatus).toBe("confirmed_external_funding");
    expect(item.publishedAt).toBe("2026-08-01T12:00:00.000Z");
    expect(item.sourceUrl).toBe("https://opencollective.com/resolve/transactions");
    // Never claims the funds paid for one specific piece of work.
    expect(item.description).not.toMatch(/paid for|caused/i);
  });

  it("degrades to empty rather than throwing when the real API call fails", async () => {
    isOpenCollectiveConfigured.mockReturnValue(true);
    fetchCollectiveContributions.mockRejectedValue(new Error("network error"));
    const { loadCommunityFundingSignals } = await import(
      "@/lib/discover/marketplace/community-funding-source"
    );
    await expect(loadCommunityFundingSignals()).resolves.toEqual([]);
  });
});
