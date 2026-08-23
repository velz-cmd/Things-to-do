import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/integrations/listenbrainz", () => ({
  fetchListenBrainzListens: vi.fn(),
  isListenBrainzConfigured: vi.fn(),
  pingListenBrainz: vi.fn(),
}));

import {
  fetchListenBrainzListens,
  isListenBrainzConfigured,
  pingListenBrainz,
} from "@/lib/integrations/listenbrainz";
import {
  loadMediaSignals,
  loadMediaSourceDiagnostic,
} from "@/lib/discover/marketplace/media-signal-source";

const mockedFetch = vi.mocked(fetchListenBrainzListens);
const mockedConfigured = vi.mocked(isListenBrainzConfigured);
const mockedPing = vi.mocked(pingListenBrainz);

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

  it("flags a real, deterministic identity uncertainty when no MusicBrainz recording ID exists", async () => {
    mockedConfigured.mockReturnValueOnce(true);
    mockedFetch.mockResolvedValueOnce([
      {
        listenedAt: "2026-08-01T12:00:00.000Z",
        artistName: "No Mbid Artist",
        trackTitle: "No Mbid Track",
      },
    ]);
    const [item] = await loadMediaSignals();
    expect(item.riskFlags).toHaveLength(1);
    expect(item.riskFlags[0]).toContain("No MusicBrainz recording ID is confirmed");
  });

  it("never flags identity uncertainty when a real MusicBrainz recording ID exists", async () => {
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
    expect(item.riskFlags).toEqual([]);
  });
});

describe("loadMediaSourceDiagnostic", () => {
  it("returns null when ListenBrainz is not configured - never a fabricated diagnostic entry", async () => {
    mockedConfigured.mockReturnValueOnce(false);
    expect(await loadMediaSourceDiagnostic()).toBeNull();
    expect(mockedPing).not.toHaveBeenCalled();
  });

  it("reports connected state from a real successful ping", async () => {
    mockedConfigured.mockReturnValueOnce(true);
    mockedPing.mockResolvedValueOnce({
      ok: true,
      message: "ListenBrainz connected · 3 recent listens · latest 2026-08-01 12:00",
    });
    const diagnostic = await loadMediaSourceDiagnostic();
    expect(diagnostic).toMatchObject({
      provider: "listenbrainz",
      state: "connected",
      stale: false,
      reason: "ListenBrainz connected · 3 recent listens · latest 2026-08-01 12:00",
    });
    expect(diagnostic?.lastSuccessfulAt).not.toBeNull();
  });

  it("reports refresh_failed state and no lastSuccessfulAt from a real failed ping - never fabricates recency", async () => {
    mockedConfigured.mockReturnValueOnce(true);
    mockedPing.mockResolvedValueOnce({ ok: false, message: "ListenBrainz HTTP 503" });
    const diagnostic = await loadMediaSourceDiagnostic();
    expect(diagnostic).toMatchObject({
      provider: "listenbrainz",
      state: "refresh_failed",
      stale: true,
      reason: "ListenBrainz HTTP 503",
      lastSuccessfulAt: null,
    });
  });
});
