import { describe, expect, it } from "vitest";
import { gapsConnectLinks } from "@/lib/discover/gaps-empty-state";

describe("gapsConnectLinks", () => {
  it("suggests music communities for artists need type", () => {
    const links = gapsConnectLinks({ needType: "artists", role: "all" });
    expect(links.some((l) => l.href.includes("independent-music"))).toBe(true);
    expect(links.some((l) => l.href.includes("navidrome"))).toBe(true);
    expect(links.every((l) => !l.label.toLowerCase().includes("github only"))).toBe(true);
  });

  it("suggests research community for researchers", () => {
    const links = gapsConnectLinks({ needType: "researchers", role: "all" });
    expect(links[0]?.href).toContain("open-research");
  });

  it("suggests OSS communities for docs need type", () => {
    const links = gapsConnectLinks({ needType: "docs", role: "all" });
    expect(links.some((l) => l.href.includes("/communities/react"))).toBe(true);
  });

  it("offers multiple ecosystems for funder role", () => {
    const links = gapsConnectLinks({ needType: "all", role: "funder" });
    expect(links.length).toBeGreaterThanOrEqual(3);
  });
});
