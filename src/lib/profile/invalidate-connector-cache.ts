import { cacheDelete } from "@/lib/cache/kv";

/** Drop KV caches that stale after Profile connector connect/disconnect. */
export async function invalidateConnectorCaches(userId: string) {
  await Promise.all([
    cacheDelete(`profile:state:${userId}`),
    cacheDelete(`profile:control-plane:${userId}`),
    cacheDelete(`communities:list:${userId}`),
  ]);
}
