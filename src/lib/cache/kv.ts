import { getRedisClient } from "@/lib/cache/redis";

const memory = new Map<string, { value: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<unknown>>();

function memoryGet<T>(key: string): T | null {
  const row = memory.get(key);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    memory.delete(key);
    return null;
  }
  return row.value as T;
}

function memorySet(key: string, value: unknown, ttlSeconds: number) {
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  if (memory.size > 500) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
}

/**
 * Shared cache — Redis when configured, in-process memory otherwise.
 * Singleflight prevents duplicate expensive builds on cold cache.
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  factory: () => Promise<T>,
): Promise<T> {
  const namespaced = key.startsWith("resolve:") ? key : `resolve:${key}`;

  const local = memoryGet<T>(namespaced);
  if (local !== null) return local;

  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get<T>(namespaced);
      if (cached !== null && cached !== undefined) {
        memorySet(namespaced, cached, ttlSeconds);
        return cached;
      }
    } catch (e) {
      console.warn("[cache] redis get failed:", namespaced, e);
    }
  }

  const pending = inflight.get(namespaced) as Promise<T> | undefined;
  if (pending) return pending;

  const work = (async () => {
    try {
      const fresh = await factory();
      memorySet(namespaced, fresh, ttlSeconds);
      if (redis) {
        try {
          await redis.set(namespaced, fresh, { ex: ttlSeconds });
        } catch (e) {
          console.warn("[cache] redis set failed:", namespaced, e);
        }
      }
      return fresh;
    } finally {
      inflight.delete(namespaced);
    }
  })();

  inflight.set(namespaced, work);
  return work;
}

export async function cacheDelete(key: string): Promise<void> {
  const namespaced = key.startsWith("resolve:") ? key : `resolve:${key}`;
  memory.delete(namespaced);
  inflight.delete(namespaced);
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(namespaced);
    } catch {
      /* non-fatal */
    }
  }
}
