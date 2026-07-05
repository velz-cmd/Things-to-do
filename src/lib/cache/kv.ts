import { getRedisClient } from "@/lib/cache/redis";

type CacheEnvelope<T> = { data: T; freshUntil: number };

const memory = new Map<string, { value: unknown; expiresAt: number; staleUntil: number }>();
const inflight = new Map<string, Promise<unknown>>();

function memoryGet<T>(key: string, allowStale = false): T | null {
  const row = memory.get(key);
  if (!row) return null;
  const now = Date.now();
  if (now > row.staleUntil) {
    memory.delete(key);
    return null;
  }
  if (!allowStale && now > row.expiresAt) return null;
  return row.value as T;
}

function memorySet(key: string, value: unknown, ttlSeconds: number, staleSeconds: number) {
  const now = Date.now();
  memory.set(key, {
    value,
    expiresAt: now + ttlSeconds * 1000,
    staleUntil: now + staleSeconds * 1000,
  });
  if (memory.size > 500) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
}

function namespaceKey(key: string) {
  return key.startsWith("resolve:") ? key : `resolve:${key}`;
}

async function readEnvelope<T>(namespaced: string): Promise<CacheEnvelope<T> | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const raw = await redis.get<CacheEnvelope<T> | T>(namespaced);
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "object" && raw !== null && "data" in raw && "freshUntil" in raw) {
      return raw as CacheEnvelope<T>;
    }
    // Legacy entries stored the payload directly
    return { data: raw as T, freshUntil: Date.now() + 60_000 };
  } catch (e) {
    console.warn("[cache] redis get failed:", namespaced, e);
    return null;
  }
}

async function writeEnvelope<T>(namespaced: string, envelope: CacheEnvelope<T>, staleSeconds: number) {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(namespaced, envelope, { ex: staleSeconds });
  } catch (e) {
    console.warn("[cache] redis set failed:", namespaced, e);
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
  return cacheGetOrSetResilient(key, ttlSeconds, factory);
}

/**
 * Resilient cache — on factory failure returns last good value (stale) up to staleSeconds.
 * Fresh TTL is ttlSeconds; stale window defaults to 3× TTL.
 */
export async function cacheGetOrSetResilient<T>(
  key: string,
  ttlSeconds: number,
  factory: () => Promise<T>,
  options?: { staleSeconds?: number },
): Promise<T> {
  const namespaced = namespaceKey(key);
  const staleSeconds = options?.staleSeconds ?? ttlSeconds * 3;
  const now = Date.now();

  const local = memoryGet<T>(namespaced);
  if (local !== null) return local;

  const envelope = await readEnvelope<T>(namespaced);
  if (envelope && envelope.freshUntil > now) {
    memorySet(namespaced, envelope.data, ttlSeconds, staleSeconds);
    return envelope.data;
  }

  const pending = inflight.get(namespaced) as Promise<T> | undefined;
  if (pending) return pending;

  const work = (async () => {
    try {
      const fresh = await factory();
      const next: CacheEnvelope<T> = { data: fresh, freshUntil: Date.now() + ttlSeconds * 1000 };
      memorySet(namespaced, fresh, ttlSeconds, staleSeconds);
      await writeEnvelope(namespaced, next, staleSeconds);
      return fresh;
    } catch (error) {
      if (envelope) {
        console.warn("[cache] factory failed — serving stale:", namespaced);
        memorySet(namespaced, envelope.data, 0, staleSeconds);
        return envelope.data;
      }
      const staleLocal = memoryGet<T>(namespaced, true);
      if (staleLocal !== null) return staleLocal;
      throw error;
    } finally {
      inflight.delete(namespaced);
    }
  })();

  inflight.set(namespaced, work);
  return work;
}

/** Read cached value without running factory — null if missing or expired. */
export async function cacheReadStale<T>(key: string): Promise<T | null> {
  const namespaced = namespaceKey(key);
  const local = memoryGet<T>(namespaced, true);
  if (local !== null) return local;
  const envelope = await readEnvelope<T>(namespaced);
  return envelope?.data ?? null;
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
