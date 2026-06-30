import { describe, expect, it } from "vitest";
import {
  estimateMusicValueUsd,
  estimateOssFundingGap,
  estimateVideoValueUsd,
} from "@/lib/discover/valuation-eligibility";

describe("valuation-eligibility", () => {
  it("caps OSS estimates and requires merge/star threshold", () => {
    const low = estimateOssFundingGap({
      stars: 10,
      forks: 2,
      mergedPrCount: 1,
      maintainerCount: 1,
    });
    expect(low.usd).toBeLessThanOrEqual(100);
    expect(low.tier).toBe("minimum");

    const high = estimateOssFundingGap({
      stars: 80_000,
      forks: 20_000,
      mergedPrCount: 120,
      maintainerCount: 1,
    });
    expect(high.usd).toBeLessThanOrEqual(25_000);
    expect(high.usd).toBeGreaterThan(1_000);
  });

  it("scales music and video with plays/views", () => {
    const music = estimateMusicValueUsd({ playCount: 50_000, uniqueListeners: 2_000 });
    expect(music.usd).toBeGreaterThan(500);
    expect(music.usd).toBeLessThanOrEqual(15_000);

    const video = estimateVideoValueUsd({ viewCount: 10_000, uniqueViewers: 800 });
    expect(video.usd).toBeGreaterThan(200);
    expect(video.usd).toBeLessThanOrEqual(12_000);
  });
});
