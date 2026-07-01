import { describe, expect, it } from "vitest";
import { gapsExploreActions, gapsExploreCommunities } from "@/lib/discover/gaps-empty-state";

describe("gapsExploreCommunities", () => {
  it("suggests music communities for artists need type", () => {
    const entries = gapsExploreCommunities({ needType: "artists", role: "all" });
    expect(entries.some((e) => e.slug === "independent-music")).toBe(true);
    expect(entries.some((e) => e.slug === "navidrome")).toBe(true);
  });

  it("suggests research community for researchers", () => {
    const entries = gapsExploreCommunities({ needType: "researchers", role: "all" });
    expect(entries.some((e) => e.slug === "open-research")).toBe(true);
  });

  it("suggests OSS communities for docs need type", () => {
    const entries = gapsExploreCommunities({ needType: "docs", role: "all" });
    expect(entries.some((e) => e.slug === "react")).toBe(true);
  });

  it("returns install actions without connect_sensor kind", () => {
    const actions = gapsExploreActions({ needType: "all", role: "funder" });
    expect(actions.length).toBeGreaterThanOrEqual(3);
    expect(actions.every((a) => a.kind === "install")).toBe(true);
  });
});
