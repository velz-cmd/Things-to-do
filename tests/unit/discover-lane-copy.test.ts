import { describe, expect, it } from "vitest";
import { DISCOVER_JOBS } from "../../src/lib/discover/discover-jobs";
import {
  DISCOVER_HERO_SUBTITLE,
  DISCOVER_SECTION,
  LANE_PURPOSE,
  WORKSPACE_LANE_LABELS,
} from "../../src/lib/discover/discover-lane-copy";

describe("discover action marketplace — phase A copy", () => {
  it("exposes explicit job labels", () => {
    const labels = DISCOVER_JOBS.map((j) => j.who);
    expect(labels).toEqual([
      "Earn from my work",
      "Fund value",
      "Run a program",
      "Run analysis",
      "Launch DAO pool",
      "Explore gaps",
    ]);
  });

  it("uses action-marketplace hero subtitle", () => {
    expect(DISCOVER_HERO_SUBTITLE).toContain("Find verified work");
  });

  it("defines lane purpose copy for each workspace tab", () => {
    expect(LANE_PURPOSE.gaps).toMatch(/no payout rule/i);
    expect(LANE_PURPOSE.radars).toMatch(/Recent proof signals/i);
    expect(LANE_PURPOSE.board).toMatch(/Ready-to-act programs/i);
  });
});

describe("discover section naming — phase D", () => {
  it("separates funding board from value graph", () => {
    expect(DISCOVER_SECTION.fundingBoard).toBe("Ready to Fund");
    expect(DISCOVER_SECTION.valueGraph).toBe("Value graph");
    expect(WORKSPACE_LANE_LABELS.board).toBe("Ready to Fund");
    expect(WORKSPACE_LANE_LABELS.gaps).toBe("Unpaid Value");
    expect(WORKSPACE_LANE_LABELS.radars).toBe("Live Signals");
  });
});
