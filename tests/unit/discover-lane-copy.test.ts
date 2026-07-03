import { describe, expect, it } from "vitest";
import { DISCOVER_JOBS } from "../../src/lib/discover/discover-jobs";
import { DISCOVER_HERO_SUBTITLE, LANE_PURPOSE } from "../../src/lib/discover/discover-lane-copy";

describe("discover action marketplace — phase A copy", () => {
  it("exposes short job pill labels including Automate", () => {
    const labels = DISCOVER_JOBS.map((j) => j.who);
    expect(labels).toEqual(["Earn", "Fund", "Build", "Automate", "Launch", "Explore"]);
  });

  it("uses action-marketplace hero subtitle", () => {
    expect(DISCOVER_HERO_SUBTITLE).toBe("Where should value move next?");
  });

  it("defines lane purpose copy for each workspace tab", () => {
    expect(LANE_PURPOSE.gaps).toMatch(/reward program/i);
    expect(LANE_PURPOSE.radars).toMatch(/proof arriving/i);
    expect(LANE_PURPOSE.board).toMatch(/fund gaps/i);
  });
});
