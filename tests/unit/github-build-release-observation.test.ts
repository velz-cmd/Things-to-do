import { describe, expect, it } from "vitest";
import { buildReleaseObservation } from "@/lib/github/opportunities";
import type { GitHubRelease } from "@/lib/github/types";

function release(overrides: Partial<GitHubRelease> = {}): GitHubRelease {
  return {
    id: 1,
    tagName: "v1.0.0",
    name: "v1.0.0",
    author: "octodev",
    publishedAt: "2026-08-01T00:00:00.000Z",
    sourceUrl: "https://github.com/acme/widgets/releases/tag/v1.0.0",
    prerelease: false,
    ...overrides,
  };
}

/**
 * Phase 2 item 2 corrective: this builds the durable observation from
 * RepoIngestResult.releases (adapter.ts's existing GitHub Releases fetch,
 * which already excludes drafts) rather than a second, redundant fetch -
 * confirms "inspect the existing integration before adding another auth
 * path" was actually followed.
 */
describe("buildReleaseObservation", () => {
  it("returns undefined when the ingest observed no releases", () => {
    expect(buildReleaseObservation([])).toBeUndefined();
  });

  it("preserves release identity and prerelease state from the ingest", () => {
    const result = buildReleaseObservation([release({ prerelease: true })]);
    expect(result).toEqual([
      {
        id: 1,
        tagName: "v1.0.0",
        name: "v1.0.0",
        publishedAt: "2026-08-01T00:00:00.000Z",
        htmlUrl: "https://github.com/acme/widgets/releases/tag/v1.0.0",
        author: "octodev",
        prerelease: true,
      },
    ]);
  });

  it("maps a missing publishedAt to null rather than fabricating a date", () => {
    const [result] = buildReleaseObservation([release({ publishedAt: undefined })])!;
    expect(result.publishedAt).toBeNull();
  });
});
