import { cacheDelete } from "@/lib/cache/kv";

/** Drop cached fast capital reads after a write (fund, claim, distribute). */
export async function bustCapitalStateCache(userId: string): Promise<void> {
  await Promise.all([
    cacheDelete(`capital:state:fast:${userId}`),
    cacheDelete(`capital:bootstrap:${userId}`),
  ]);
}
