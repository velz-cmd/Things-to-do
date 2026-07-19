import { describe, expect, it } from "vitest";
import { staleConnectionState, type UserConnectionState } from "@/lib/profile/connection-state-types";
import { mergeConnectionStates } from "@/lib/profile/connection-snapshot-client";

function state(input: Partial<UserConnectionState> = {}): UserConnectionState {
  return {
    signedIn: true,
    userId: "user-1",
    updatedAt: "2026-07-19T10:00:00.000Z",
    lastSyncedAt: "2026-07-19T10:00:00.000Z",
    platforms: [{ id: "github", label: "GitHub", connected: true, syncStatus: "connected" }],
    installedCommunitySlugs: [],
    hasAnyConnector: true,
    githubUsername: "resolve-user",
    ...input,
  };
}

describe("Profile connection cache", () => {
  it("lets a newer persisted disconnect replace an older connected snapshot", () => {
    const current = state();
    const disconnected = state({
      updatedAt: "2026-07-19T10:01:00.000Z",
      platforms: [{ id: "github", label: "GitHub", connected: false, syncStatus: "not_connected" }],
      hasAnyConnector: false,
      githubUsername: null,
    });
    expect(mergeConnectionStates(current, disconnected).platforms[0]?.connected).toBe(false);
  });

  it("labels last-known connected data stale when refresh fails", () => {
    const stale = staleConnectionState(state());
    expect(stale.degraded).toBe(true);
    expect(stale.platforms[0]?.connected).toBe(true);
    expect(stale.platforms[0]?.syncStatus).toBe("stale");
  });
});
