import { afterEach, describe, expect, it } from "vitest";
import { buildGithubAppInstallUrl } from "@/lib/integrations/github-app";
import { mergeConnectionStates } from "@/lib/profile/connection-snapshot-client";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";

const originalInstallUrl = process.env.GITHUB_APP_INSTALL_URL;
const originalSlug = process.env.GITHUB_APP_SLUG;

function state(
  updatedAt: string,
  platforms: UserConnectionState["platforms"],
): UserConnectionState {
  return {
    signedIn: true,
    userId: "user-1",
    updatedAt,
    lastSyncedAt: updatedAt,
    platforms,
    installedCommunitySlugs: [],
    hasAnyConnector: platforms.some((row) => row.connected),
    githubUsername: "octocat",
  };
}

afterEach(() => {
  if (originalInstallUrl === undefined) delete process.env.GITHUB_APP_INSTALL_URL;
  else process.env.GITHUB_APP_INSTALL_URL = originalInstallUrl;
  if (originalSlug === undefined) delete process.env.GITHUB_APP_SLUG;
  else process.env.GITHUB_APP_SLUG = originalSlug;
});

describe("shared GitHub connection state", () => {
  it("does not let an older degraded response erase confirmed identity or installation access", () => {
    const confirmed = state("2026-07-28T10:00:00.000Z", [
      {
        id: "github",
        label: "GitHub",
        connected: true,
        displayValue: "@octocat",
        syncStatus: "connected",
      },
      {
        id: "github_app",
        label: "GitHub repository access",
        connected: true,
        displayValue: "3 repositories",
        syncStatus: "connected",
      },
    ]);
    const degraded = state("2026-07-28T09:00:00.000Z", [
      { id: "github", label: "GitHub", connected: false },
      {
        id: "github_app",
        label: "GitHub repository access",
        connected: false,
      },
    ]);

    const merged = mergeConnectionStates(confirmed, degraded);

    expect(merged.platforms.find((row) => row.id === "github")?.connected).toBe(true);
    expect(merged.platforms.find((row) => row.id === "github_app")?.connected).toBe(true);
    expect(merged.platforms.find((row) => row.id === "github_app")?.displayValue).toBe(
      "3 repositories",
    );
  });

  it("builds a GitHub App installation URL with the callback state", () => {
    process.env.GITHUB_APP_INSTALL_URL =
      "https://github.com/apps/resolve-example/installations/new";
    delete process.env.GITHUB_APP_SLUG;

    expect(buildGithubAppInstallUrl("state-123")).toBe(
      "https://github.com/apps/resolve-example/installations/new?state=state-123",
    );
  });
});
