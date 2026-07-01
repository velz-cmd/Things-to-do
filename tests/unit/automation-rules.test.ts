import { describe, expect, it } from "vitest";
import {
  simulateAutomationRule,
  defaultTriggerForCommunityKind,
  listTriggerOptions,
} from "../../src/lib/automation/simulate";
import { triggerForIngestEvent, getTriggerDef } from "../../src/lib/automation/types";

describe("automation triggers", () => {
  it("maps ingest events to triggers", () => {
    expect(
      triggerForIngestEvent({ connectorId: "github", eventType: "contribution.merge" }),
    ).toBe("docs_merge");
    expect(
      triggerForIngestEvent({ connectorId: "listenbrainz", eventType: "scrobble.play" }),
    ).toBe("play");
    expect(
      triggerForIngestEvent({ connectorId: "openalex", eventType: "feed.cite" }),
    ).toBe("citation");
    expect(
      triggerForIngestEvent({ connectorId: "jellyfin", eventType: "video.watch" }),
    ).toBe("view");
  });

  it("lists four MVP triggers with prices", () => {
    const options = listTriggerOptions();
    expect(options).toHaveLength(4);
    expect(getTriggerDef("docs_merge").defaultAuthorizeUsd).toBe(25);
    expect(getTriggerDef("play").defaultAuthorizeUsd).toBe(0.0004);
  });

  it("simulates projected spend", () => {
    const sim = simulateAutomationRule({
      triggerEvent: "citation",
      authorizeUsd: 0.05,
      notifyChannel: "email",
      sampleEvents: 100,
    });
    expect(sim.projectedAuthorizeUsd).toBe(5);
    expect(sim.connectorId).toBe("openalex");
  });

  it("picks default trigger by community kind", () => {
    expect(defaultTriggerForCommunityKind("music")).toBe("play");
    expect(defaultTriggerForCommunityKind("research")).toBe("citation");
    expect(defaultTriggerForCommunityKind("media")).toBe("view");
    expect(defaultTriggerForCommunityKind("oss")).toBe("docs_merge");
  });
});
