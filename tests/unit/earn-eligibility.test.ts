import { describe, expect, it } from "vitest";
import { EARN_ELIGIBILITY_RULES } from "../../src/lib/earn/eligibility-copy";

describe("earn eligibility copy", () => {
  it("defines YouTube-style thresholds per domain", () => {
    expect(EARN_ELIGIBILITY_RULES.map((r) => r.id)).toEqual([
      "oss",
      "music",
      "video",
      "research",
    ]);
    const oss = EARN_ELIGIBILITY_RULES.find((r) => r.id === "oss");
    expect(oss?.threshold).toContain("5+");
    expect(oss?.threshold).toContain("100+");
    const music = EARN_ELIGIBILITY_RULES.find((r) => r.id === "music");
    expect(music?.threshold).toContain("1,000+");
  });
});
