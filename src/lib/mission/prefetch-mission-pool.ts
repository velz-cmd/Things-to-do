import {
  poolCacheKey,
  readPoolCache,
  writePoolCache,
} from "@/lib/capital/pool-cache";
import type { ProgramPoolState } from "@/lib/capital/pool-checkpoint-types";

export type MissionPoolSnapshot = {
  pool: ProgramPoolState | null;
  programId: string | null;
};

/** Warm pool cache before Blueprint renders — target &lt;3s first paint. */
export async function prefetchMissionPool(slug: string): Promise<MissionPoolSnapshot> {
  const key = poolCacheKey(slug, null);
  const cached = readPoolCache(key);
  if (cached) {
    return { pool: cached, programId: cached.programId ?? null };
  }

  try {
    const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/pool`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return { pool: null, programId: null };
    const data = (await res.json()) as {
      pool?: ProgramPoolState | null;
      programId?: string | null;
    };
    const pool = data.pool ?? null;
    if (pool) writePoolCache(key, pool);
    return {
      pool,
      programId: data.programId ?? pool?.programId ?? null,
    };
  } catch {
    return { pool: null, programId: null };
  }
}
