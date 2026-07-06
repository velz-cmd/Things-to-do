import { describe, expect, it } from "vitest";
import {
  estimateMusicValueUsd,
  estimateOssFundingGap,
  estimateResearchValueUsd,
  estimateVideoValueUsd,
} from "@/lib/discover/valuation-eligibility";

describe("valuation-eligibility", () => {
  it("pays $10 OSS blocks at merge/star threshold", () => {
    const low = estimateOssFundingGap({
      stars: 10,
      forks: 2,
      mergedPrCount: 1,
      maintainerCount: 1,
    });
    expect(low.usd).toBe(0);

    const qualified = estimateOssFundingGap({
      stars: 120,
      forks: 20,
      mergedPrCount: 6,
      maintainerCount: 2,
    });
    expect(qualified.usd).toBeGreaterThanOrEqual(10);
    expect(qualified.usd).toBeLessThanOrEqual(25_000);
  });

  it("pays $10 per 500 plays and 1000 views", () => {
    const music = estimateMusicValueUsd({ playCount: 500 });
    expect(music.usd).toBe(10);

    const music2k = estimateMusicValueUsd({ playCount: 2_000 });
    expect(music2k.usd).toBe(40);

    const video = estimateVideoValueUsd({ viewCount: 1_000 });
    expect(video.usd).toBe(10);

    const research = estimateResearchValueUsd({ viewCount: 1_000 });
    expect(research.usd).toBe(10);
  });
});
