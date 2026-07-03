import { describe, expect, it } from "vitest";
import { DISCOVER_JOBS } from "../../src/lib/discover/discover-jobs";
import {
  DISCOVER_HERO_SUBTITLE,
  DISCOVER_SECTION,
  LANE_PURPOSE,
  WORKSPACE_LANE_LABELS,
} from "../../src/lib/discover/discover-lane-copy";

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
    expect(LANE_PURPOSE.board).toMatch(/Ranked programs/i);
  });
});

describe("discover section naming — phase D", () => {
  it("separates funding board from value graph", () => {
    expect(DISCOVER_SECTION.fundingBoard).toBe("Funding board");
    expect(DISCOVER_SECTION.valueGraph).toBe("Value graph");
    expect(WORKSPACE_LANE_LABELS.board).toBe("Funding board");
    expect(WORKSPACE_LANE_LABELS.gaps).toBe("Unpaid Value");
    expect(WORKSPACE_LANE_LABELS.radars).toBe("Live Signals");
  });
});
