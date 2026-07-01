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

  it("returns balanced attach actions for community role (not music-only)", () => {
    const actions = gapsExploreActions({ needType: "all", role: "community" });
    const slugs = actions.map((a) => a.communitySlug).filter(Boolean);
    expect(slugs.some((s) => s === "react" || s === "open-research")).toBe(true);
    expect(actions.length).toBeLessThanOrEqual(3);
  });

  it("skips already-attached communities", () => {
    const actions = gapsExploreActions({
      needType: "all",
      role: "all",
      installedSlugs: ["independent-music", "navidrome"],
    });
    expect(actions.every((a) => !["independent-music", "navidrome"].includes(a.communitySlug ?? ""))).toBe(
      true,
    );
  });
});
