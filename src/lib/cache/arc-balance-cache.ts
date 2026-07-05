import { cacheGetOrSet } from "@/lib/cache/kv";
import {
  getArcUsdcBalance,
  type ArcUsdcBalance,
} from "@/lib/wallet/arc-usdc-balance";

const TTL_SECONDS = 20;

/** Shared Arc on-chain USDC read — Redis when configured, in-process singleflight otherwise. */
export async function getCachedArcUsdcBalance(address: string): Promise<ArcUsdcBalance> {
  const normalized = address.trim().toLowerCase();
  return cacheGetOrSet(`arc:balance:${normalized}`, TTL_SECONDS, () =>
    getArcUsdcBalance(normalized),
  );
}
