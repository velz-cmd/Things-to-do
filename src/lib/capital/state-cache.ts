import { cacheDelete } from "@/lib/cache/kv";

/** Drop cached fast capital reads after a write (fund, claim, distribute). */
export async function bustCapitalStateCache(userId: string): Promise<void> {
  await cacheDelete(`capital:state:fast:${userId}`);
}
