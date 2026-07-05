import { describe, expect, it } from "vitest";
import { fundOutcomeSteps } from "../../src/lib/discover/discover-action-outcomes";

describe("fundOutcomeSteps", () => {
  it("routes proof, capital activity, and program rules to distinct pages", () => {
    const steps = fundOutcomeSteps({
      amountUsd: 5,
      communitySlug: "navidrome",
      programId: "prog-1",
      activityId: "act-123",
    });

    expect(steps.find((s) => s.id === "proof")?.href).toBe("/receipt/act-123");
    expect(steps.find((s) => s.id === "capital")?.href).toBe("/capital?tab=activity");
    expect(steps.find((s) => s.id === "program")?.href).toBe(
      "/communities/navidrome?tab=advanced&program=prog-1#programs",
    );

    const hrefs = steps.map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("falls back to community pool anchor when no activity receipt yet", () => {
    const steps = fundOutcomeSteps({
      amountUsd: 5,
      communitySlug: "navidrome",
      programId: "prog-1",
    });

    expect(steps[0]?.href).toContain("#pool-checkpoints");
    expect(steps[0]?.href).not.toContain("tab=advanced");
  });
});
