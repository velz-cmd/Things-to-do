import { beforeEach, describe, expect, it, vi } from "vitest";

const { cacheDelete } = vi.hoisted(() => ({ cacheDelete: vi.fn() }));

vi.mock("@/lib/cache/kv", () => ({ cacheDelete }));

import {
  DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS,
  invalidateDiscoverProgramCache,
} from "@/lib/discover/marketplace/cache";

describe("Discover marketplace cache invalidation", () => {
  beforeEach(() => {
    cacheDelete.mockReset();
  });

  it("invalidates the canonical program source after a program write", async () => {
    cacheDelete.mockResolvedValue(undefined);

    await invalidateDiscoverProgramCache();

    expect(cacheDelete).toHaveBeenCalledOnce();
    expect(cacheDelete).toHaveBeenCalledWith(
      DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.programs,
    );
  });
});
