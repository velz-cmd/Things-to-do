import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { CapitalStateResponse } from "@/lib/capital/state";

const inflight = new Map<string, Promise<CapitalStateResponse>>();

/** Collapse concurrent capital loads for the same user (prevents RPC/DB stampedes). */
export function withCapitalStateInflight(
  userId: string,
  liveSync: boolean,
  factory: () => Promise<CapitalStateResponse>,
): Promise<CapitalStateResponse> {
  const key = `${liveSync ? "live" : "fast"}:${userId}`;
  const pending = inflight.get(key);
  if (pending) return pending;

  const work = factory().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, work);
  return work;
}

export function capitalStateKey(user: SupabaseUser, liveSync: boolean): string {
  return `${user.id}:${liveSync ? "live" : "fast"}`;
}
