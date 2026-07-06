import { describe, expect, it, beforeEach } from "vitest";
import {
  poolCacheKey,
  readPoolCache,
  writePoolCache,
} from "../../src/lib/capital/pool-cache";
import type { ProgramPoolState } from "../../src/lib/capital/pool-checkpoint-types";

const samplePool = {
  programId: "p1",
  programName: "Test pool",
  poolBalanceUsd: 100,
  owedToCreatorsUsd: 250,
  contributorCount: 3,
  funderCount: 1,
  payeeCategory: "creators",
} as ProgramPoolState;

describe("pool-cache", () => {
  beforeEach(() => {
    if (typeof sessionStorage !== "undefined") sessionStorage.clear();
  });

  it("round-trips pool state by cache key", () => {
    if (typeof sessionStorage === "undefined") return;
    const key = poolCacheKey("navidrome", null, "user-centric-royalties");
    expect(readPoolCache(key)).toBeNull();
    writePoolCache(key, samplePool);
    expect(readPoolCache(key)?.owedToCreatorsUsd).toBe(250);
  });
});
