import { describe, expect, it } from "vitest";
import {
  buildObserveNarrative,
  computeCommunityHealth,
} from "../../src/lib/communities/vitals-compute";
import type { CommunitySensorStatus } from "../../src/lib/sensors/catalog-visibility";

describe("community vitals", () => {
  it("builds observe narrative from connector list", () => {
    const narrative = buildObserveNarrative({
      name: "React",
      connectors: ["github", "opencollective"],
    });
    expect(narrative).toContain("RESOLVE will now observe");
    expect(narrative).toContain("GitHub");
    expect(narrative).toContain("Open Collective");
  });

  it("computes health from connectors and sensor state", () => {
    const sensor: CommunitySensorStatus = {
      slug: "navidrome",
      sensorGated: false,
      sensorLive: true,
      sensorReady: true,
      message: "Live",
    };
    const { healthPct, healthLabel } = computeCommunityHealth({
      connectors: ["navidrome", "musicbrainz"],
      connectorStatuses: [
        {
          id: "navidrome",
          label: "Navidrome",
          description: "",
          catalogStatus: "live",
          installed: true,
          health: "healthy",
          eventsToday: 2,
          authorizationVolumeUsd: 10,
          authorizationCount: 2,
          lastEventAt: null,
          docsPath: null,
        },
        {
          id: "musicbrainz",
          label: "MusicBrainz",
          description: "",
          catalogStatus: "live",
          installed: false,
          health: "waiting",
          eventsToday: 0,
          authorizationVolumeUsd: 0,
          authorizationCount: 0,
          lastEventAt: null,
          docsPath: null,
        },
      ],
      sensor,
      hasPrograms: true,
      hasOpenWork: false,
    });
    expect(healthPct).toBeGreaterThan(50);
    expect(healthLabel).toBeTruthy();
  });

  it("returns null health when gated sensor lacks credentials", () => {
    const sensor: CommunitySensorStatus = {
      slug: "react",
      sensorGated: true,
      sensorLive: false,
      sensorReady: false,
      message: "Awaiting GITHUB_TOKEN",
    };
    const { healthPct } = computeCommunityHealth({
      connectors: ["github"],
      connectorStatuses: [],
      sensor,
      hasPrograms: false,
      hasOpenWork: false,
    });
    expect(healthPct).toBeNull();
  });
});
