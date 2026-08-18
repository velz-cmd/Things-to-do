import "server-only";

import { cacheDelete } from "@/lib/cache/kv";

export const DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS = {
  published: "discover:marketplace:published:v3",
  programs: "discover:marketplace:programs:v3",
  campaigns: "discover:marketplace:campaigns:v3",
  githubWork: "discover:marketplace:github-work:v2",
  githubStore: "discover:github-oss-store:v2",
  publicPeople: "discover:people:v2:public",
  outcomes: "discover:marketplace:confirmed-outcomes:v1",
  communityFunding: "discover:marketplace:community-funding:v1",
} as const;

export async function invalidateDiscoverGithubCache(): Promise<void> {
  await Promise.all([
    cacheDelete(DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.githubWork),
    cacheDelete(DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.githubStore),
    cacheDelete(DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.publicPeople),
  ]);
}

export async function invalidateDiscoverProgramCache(userId?: string): Promise<void> {
  await Promise.all([
    cacheDelete(DISCOVER_MARKETPLACE_SOURCE_CACHE_KEYS.programs),
    ...(userId
      ? [
          cacheDelete(`discover:my-communities:v2:${userId}`),
          cacheDelete(`discover:people:v2:${userId}`),
        ]
      : []),
  ]);
}
