import { getAddress } from "viem";
import { getCircleClient } from "@/lib/settlement/circle-client";
import { getCircleWalletSetId } from "@/lib/wallet/circle-config";
import {
  ARC_CLIENT_WALLET_ADDRESS,
  ARC_CLIENT_WALLET_ID,
  ARC_PROVIDER_WALLET_ADDRESS,
  ARC_PROVIDER_WALLET_ID,
} from "@/lib/settlement/arc-config";

const idByAddress = new Map<string, string>();

async function lookupCircleWalletIdByAddress(
  address: string,
): Promise<string | null> {
  const normalized = getAddress(address).toLowerCase();
  const cached = idByAddress.get(normalized);
  if (cached) return cached;

  const circle = await getCircleClient();
  if (!circle) return null;

  const walletSetId = await getCircleWalletSetId();
  const res = await circle.listWallets({
    address: normalized,
    blockchain: "ARC-TESTNET",
    ...(walletSetId ? { walletSetId } : {}),
    pageSize: 5,
  });

  const id = res.data?.wallets?.find(
    (w) => w.address?.toLowerCase() === normalized,
  )?.id;
  if (id) idByAddress.set(normalized, id);
  return id ?? null;
}

/** Env var first; otherwise resolve from Circle by treasury address. */
export async function getResolvedArcClientWalletId(): Promise<string | null> {
  const fromEnv = ARC_CLIENT_WALLET_ID?.trim();
  if (fromEnv) return fromEnv;
  if (!ARC_CLIENT_WALLET_ADDRESS) return null;
  return lookupCircleWalletIdByAddress(ARC_CLIENT_WALLET_ADDRESS);
}

/** Env var first; otherwise resolve from Circle by provider address. */
export async function getResolvedArcProviderWalletId(): Promise<string | null> {
  const fromEnv = ARC_PROVIDER_WALLET_ID?.trim();
  if (fromEnv) return fromEnv;
  if (!ARC_PROVIDER_WALLET_ADDRESS) return null;
  return lookupCircleWalletIdByAddress(ARC_PROVIDER_WALLET_ADDRESS);
}
