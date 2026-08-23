import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/github-funding-yaml", () => ({
  fetchFundingChannels: vi.fn(),
}));

import { fetchFundingChannels } from "@/lib/integrations/github-funding-yaml";
import { observeExternalFundingContext } from "@/lib/github/opportunities";

const mockedFetch = vi.mocked(fetchFundingChannels);

describe("observeExternalFundingContext", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns undefined when no FUNDING.yml was observed", async () => {
    mockedFetch.mockResolvedValueOnce(undefined);
    const result = await observeExternalFundingContext("acme", "widgets");
    expect(result).toBeUndefined();
  });

  it("returns an empty-channels observation when the file exists but nothing recognized was parsed", async () => {
    mockedFetch.mockResolvedValueOnce([]);
    const result = await observeExternalFundingContext("acme", "widgets");
    expect(result).toEqual({ channels: [], observedAt: expect.any(String) });
  });

  it("returns real parsed channels with a real observedAt timestamp", async () => {
    mockedFetch.mockResolvedValueOnce([
      { provider: "patreon", account: "real", url: "https://www.patreon.com/real" },
    ]);
    const result = await observeExternalFundingContext("acme", "widgets");
    expect(result?.channels).toEqual([
      { provider: "patreon", account: "real", url: "https://www.patreon.com/real" },
    ]);
    expect(new Date(result!.observedAt).toISOString()).toBe(result!.observedAt);
  });

  it("never throws when the connector rejects - returns undefined instead", async () => {
    mockedFetch.mockRejectedValueOnce(new Error("outage"));
    const result = await observeExternalFundingContext("acme", "widgets");
    expect(result).toBeUndefined();
  });
});
