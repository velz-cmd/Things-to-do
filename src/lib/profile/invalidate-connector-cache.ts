import { cacheDelete } from "@/lib/cache/kv";

/** Drop KV caches that stale after Profile connector connect/disconnect. */
export async function invalidateConnectorCaches(userId: string) {
  await Promise.all([
    cacheDelete(`profile:state:${userId}`),
    cacheDelete(`profile:state:fast:${userId}`),
    cacheDelete(`profile:control-plane:${userId}`),
    cacheDelete(`communities:list:${userId}`),
    cacheDelete(`discover:my-communities:v2:${userId}`),
    cacheDelete(`discover:people:v2:${userId}`),
    cacheDelete("discover:people:v2:public"),
  ]);
}
