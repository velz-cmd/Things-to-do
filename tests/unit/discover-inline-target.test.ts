import { describe, expect, it } from "vitest";
import { communitySlugFromDiscoverTarget } from "../../src/lib/discover/discover-inline-target";

describe("communitySlugFromDiscoverTarget", () => {
  it("extracts slug from community paths", () => {
    expect(communitySlugFromDiscoverTarget("/communities/jellyfin")).toBe("jellyfin");
    expect(communitySlugFromDiscoverTarget("/communities/react/console")).toBe("react");
    expect(communitySlugFromDiscoverTarget("/capital")).toBeNull();
  });
});
