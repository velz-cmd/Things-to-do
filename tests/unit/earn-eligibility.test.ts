import { describe, expect, it } from "vitest";
import { EARN_ELIGIBILITY_RULES } from "../../src/lib/earn/eligibility-copy";
import { batchIntoCohorts, COHORT_POOL_SIZE } from "../../src/lib/earn/discover-eligibility";

describe("earn eligibility copy", () => {
  it("defines block thresholds per domain", () => {
    expect(EARN_ELIGIBILITY_RULES.map((r) => r.id)).toEqual([
      "oss",
      "music",
      "video",
      "research",
    ]);
    const music = EARN_ELIGIBILITY_RULES.find((r) => r.id === "music");
    expect(music?.threshold).toContain("500");
    expect(music?.threshold).toContain("$10");
    const research = EARN_ELIGIBILITY_RULES.find((r) => r.id === "research");
    expect(research?.threshold).toContain("1,000");
  });

  it("batches cohorts of 10", () => {
    const items = Array.from({ length: 23 }, (_, i) => i);
    const cohorts = batchIntoCohorts(items);
    expect(cohorts).toHaveLength(3);
    expect(cohorts[0]).toHaveLength(COHORT_POOL_SIZE);
    expect(cohorts[2]).toHaveLength(3);
  });
});
