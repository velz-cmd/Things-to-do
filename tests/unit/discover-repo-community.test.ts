import { describe, expect, it } from "vitest";
import { resolveCommunityForRepo } from "../../src/lib/discover/repo-community";

describe("resolveCommunityForRepo", () => {
  it("maps navidrome/navidrome to navidrome community", () => {
    expect(resolveCommunityForRepo("navidrome", "navidrome")).toEqual({
      communitySlug: "navidrome",
      templateId: "user-centric-royalties",
    });
  });

  it("maps immich-app/immich to jellyfin community", () => {
    expect(resolveCommunityForRepo("immich-app", "immich")).toEqual({
      communitySlug: "jellyfin",
      templateId: "video-royalties",
    });
  });

  it("falls back to react for unknown OSS repos", () => {
    const result = resolveCommunityForRepo("unknown-org", "unknown-repo");
    expect(result.communitySlug).toBe("react");
    expect(result.templateId).toBe("docs-bounty");
  });
});
