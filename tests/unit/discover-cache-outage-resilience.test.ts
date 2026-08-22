import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Phase 1C: confirmed marketplace observations must survive a temporary
 * provider outage - "27 confirmed citations" must not become "0 citations"
 * just because a refresh attempt failed. cacheGetOrSetResilient already
 * implements this (serve the last good value when the factory throws and
 * a previous envelope exists); this test proves it end-to-end against a
 * fake Redis-shaped store, the way it actually behaves in production
 * (this repo's persisted cache is Redis-backed - real DB-level durability
 * for confirmed observations is a separate, larger schema change outside
 * this slice).
 */
const store = new Map<string, unknown>();
const fakeRedis = {
  get: vi.fn(async (key: string) => store.get(key) ?? null),
  set: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  }),
};

vi.mock("@/lib/cache/redis", () => ({
  getRedisClient: () => fakeRedis,
}));

import { cacheGetOrSetResilient } from "@/lib/cache/kv";

describe("cacheGetOrSetResilient - survives a provider outage", () => {
  beforeEach(() => {
    store.clear();
    fakeRedis.get.mockClear();
    fakeRedis.set.mockClear();
  });

  it("keeps serving the last confirmed value when the source refresh fails, instead of returning empty", async () => {
    const key = `outage-test-${Math.random()}`;

    // First call: source succeeds, real value persisted.
    const confirmed = await cacheGetOrSetResilient(
      key,
      1, // 1s fresh TTL, so the next call is guaranteed to be past it
      async () => ({ citations: 27 }),
    );
    expect(confirmed).toEqual({ citations: 27 });

    await new Promise((r) => setTimeout(r, 1100));

    // Second call: source now fails (provider outage). Must still return
    // the previously confirmed value, not an empty/zeroed result.
    const duringOutage = await cacheGetOrSetResilient(
      key,
      1,
      async () => {
        throw new Error("provider outage");
      },
    );
    expect(duringOutage).toEqual({ citations: 27 });
  });

  it("propagates the failure only when there is no prior confirmed value to fall back to", async () => {
    const key = `outage-test-cold-${Math.random()}`;
    await expect(
      cacheGetOrSetResilient(key, 1, async () => {
        throw new Error("provider outage, nothing cached yet");
      }),
    ).rejects.toThrow("provider outage");
  });
});
