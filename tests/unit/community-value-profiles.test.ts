import { describe, expect, it } from "vitest";
import {
  buildPreviewValueSignals,
  buildUnpaidValueMetrics,
  gapsHeadlineForProfile,
  getCommunityValueProfile,
  operationalActionsForCommunity,
  radarHeadlineForProfile,
} from "../../src/lib/discover/community-value-profiles";

describe("community value profiles", () => {
  it("uses unpaid-value titles — not sensor product labels", () => {
    const jellyfin = getCommunityValueProfile("jellyfin");
    expect(jellyfin?.unpaidTitle).toContain("watch time");
    expect(jellyfin?.unpaidTitle).not.toContain("sensor");
    expect(jellyfin?.product).toBe("Jellyfin server");

    const react = getCommunityValueProfile("react");
    expect(react?.unpaidTitle).toContain("payout program");
    expect(react?.valueEvents.some((e) => e.event === "github.pr.merged")).toBe(true);
  });

  it("radar headlines differ from unpaid-value titles", () => {
    const profile = getCommunityValueProfile("react")!;
    const gaps = gapsHeadlineForProfile(profile);
    const radar = radarHeadlineForProfile(profile, "oss");
    expect(radar).not.toBe(gaps);
    expect(gaps).toContain("payout program");
    expect(radar).toContain("maintainer");
  });

  it("funder role only surfaces fund action", () => {
    const actions = operationalActionsForCommunity("funder", {
      communitySlug: "navidrome",
      templateId: "user-centric-royalties",
      communityName: "Navidrome",
      installed: false,
    });
    expect(actions).toHaveLength(1);
    expect(actions[0]?.kind).toBe("fund");
  });

  it("founder role includes setup and operate chain when not installed", () => {
    const actions = operationalActionsForCommunity("founder", {
      communitySlug: "navidrome",
      templateId: "user-centric-royalties",
      communityName: "Navidrome",
      installed: false,
    });
    expect(actions.some((a) => a.kind === "connect_sensor")).toBe(true);
    expect(actions.some((a) => a.kind === "fund")).toBe(true);
  });

  it("founder jellyfin row includes scan, rule, fund, and proof actions", () => {
    const actions = operationalActionsForCommunity("founder", {
      communitySlug: "jellyfin",
      templateId: "video-royalties",
      communityName: "Jellyfin",
      installed: false,
    });
    expect(actions.some((a) => a.label.includes("Scan"))).toBe(true);
    expect(actions.some((a) => a.label.includes("pay-per-minute"))).toBe(true);
    expect(actions.some((a) => a.kind === "fund")).toBe(true);
    expect(actions.some((a) => a.label.includes("proof"))).toBe(true);
  });

  it("preview value signals show honest unpaid metrics", () => {
    const signals = buildPreviewValueSignals("jellyfin", false);
    expect(signals.some((s) => s.event === "payout.rules")).toBe(true);
    expect(signals.some((s) => s.event === "settlement.status")).toBe(true);
    expect(signals.every((s) => !s.settled)).toBe(true);

    const metrics = buildUnpaidValueMetrics("jellyfin", false);
    expect(metrics.observedEvents).toBe("Source not connected");
    expect(metrics.payoutRules).toBe("Rule missing");
    expect(metrics.settlement).toBe("Pool unfunded");
  });
});
