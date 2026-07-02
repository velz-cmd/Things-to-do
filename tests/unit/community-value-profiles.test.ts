import { describe, expect, it } from "vitest";
import {
  buildPreviewValueSignals,
  gapsHeadlineForProfile,
  getCommunityValueProfile,
  operationalActionsForCommunity,
  radarHeadlineForProfile,
} from "../../src/lib/discover/community-value-profiles";

describe("community value profiles", () => {
  it("defines upstream products — not sensor tabs", () => {
    const jellyfin = getCommunityValueProfile("jellyfin");
    expect(jellyfin?.product).toBe("Jellyfin server");
    expect(jellyfin?.valueEvents.some((e) => e.event === "video.watch")).toBe(true);

    const react = getCommunityValueProfile("react");
    expect(react?.product).toBe("React ecosystem");
    expect(react?.valueEvents.some((e) => e.event === "github.pr.merged")).toBe(true);
  });

  it("radar headlines differ from gaps headlines", () => {
    const profile = getCommunityValueProfile("react")!;
    const gaps = gapsHeadlineForProfile(profile);
    const radar = radarHeadlineForProfile(profile, "oss");
    expect(radar).not.toBe(gaps);
    expect(radar).toContain("maintainer");
  });

  it("operational actions include connect before fund when not installed", () => {
    const actions = operationalActionsForCommunity("funder", {
      communitySlug: "navidrome",
      templateId: "user-centric-royalties",
      communityName: "Navidrome",
      installed: false,
    });
    expect(actions.some((a) => a.kind === "connect_sensor")).toBe(true);
    expect(actions.some((a) => a.kind === "fund")).toBe(true);
  });

  it("preview value signals mark unsettled value", () => {
    const signals = buildPreviewValueSignals("jellyfin", false);
    expect(signals.every((s) => !s.settled)).toBe(true);
    expect(signals[0]?.label).toBeTruthy();
  });
});
