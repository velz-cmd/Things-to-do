import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/listenbrainz", () => ({
  fetchListenBrainzListens: vi.fn(),
  isListenBrainzConfigured: vi.fn(),
}));

import {
  fetchListenBrainzListens,
  isListenBrainzConfigured,
} from "@/lib/integrations/listenbrainz";
import { loadMediaSignals } from "@/lib/discover/marketplace/media-signal-source";

const mockedFetch = vi.mocked(fetchListenBrainzListens);
const mockedConfigured = vi.mocked(isListenBrainzConfigured);

describe("loadMediaSignals", () => {
  it("returns an empty list when ListenBrainz is not configured", async () => {
    mockedConfigured.mockReturnValueOnce(false);
    expect(await loadMediaSignals()).toEqual([]);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("returns an empty list when the connector throws", async () => {
    mockedConfigured.mockReturnValueOnce(true);
    mockedFetch.mockRejectedValueOnce(new Error("down"));
    expect(await loadMediaSignals()).toEqual([]);
  });

  it("maps a real verified listen into a media Verified Work item, never inferring royalty/popularity", async () => {
    mockedConfigured.mockReturnValueOnce(true);
    mockedFetch.mockResolvedValueOnce([
      {
        listenedAt: "2026-08-01T12:00:00.000Z",
        artistName: "Test Artist",
        trackTitle: "Test Track",
        recordingMbid: "mbid-123",
      },
    ]);
    const [item] = await loadMediaSignals();
    expect(item.id).toBe("listenbrainz:mbid-123");
    expect(item.marketplaceKind).toBe("verified_work");
    expect(item.funding).toBeUndefined();
    expect(item.impactProfile).toEqual({
      measurable: true,
      signals: [
        expect.objectContaining({
          id: "listenbrainz_verified_listen",
          scope: "artifact",
          source: "ListenBrainz",
          value: "1",
        }),
      ],
    });
  });

  it("derives a stable id from artist/track/timestamp when no recordingMbid exists", async () => {
    mockedConfigured.mockReturnValueOnce(true);
    mockedFetch.mockResolvedValueOnce([
      {
        listenedAt: "2026-08-01T12:00:00.000Z",
        artistName: "No Mbid Artist",
        trackTitle: "No Mbid Track",
      },
    ]);
    const [item] = await loadMediaSignals();
    expect(item.id).toMatch(/^listenbrainz:[0-9a-f]{16}$/);
  });
});
