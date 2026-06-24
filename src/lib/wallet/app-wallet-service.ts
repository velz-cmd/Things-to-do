import { prisma } from "@/lib/db";
import type { User as DbUser } from "@prisma/client";
import { embeddedWalletFor } from "@/lib/wallet/embedded";
import { getCircleClient } from "@/lib/settlement/circle-client";
import { hasCircleCredentials } from "@/lib/settlement/arc-config";

type AppWalletMeta = {
  provider: "circle" | "embedded";
  circleWalletId?: string;
};

function readMeta(json: string | null | undefined): AppWalletMeta | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as { appWallet?: AppWalletMeta };
    return parsed.appWallet ?? null;
  } catch {
    return null;
  }
}

function writeMeta(existing: string | null | undefined, meta: AppWalletMeta): string {
  let base: Record<string, unknown> = {};
  if (existing) {
    try {
      base = JSON.parse(existing) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  base.appWallet = meta;
  return JSON.stringify(base);
}

async function createCircleAppWallet(userId: string): Promise<{
  address: `0x${string}`;
  circleWalletId: string;
} | null> {
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID?.trim();
  if (!hasCircleCredentials() || !walletSetId) return null;

  const circle = await getCircleClient();
  if (!circle) return null;

  try {
    const res = await circle.createWallets({
      walletSetId,
      blockchains: ["ARC-TESTNET"],
      count: 1,
      idempotencyKey: `resolve-app-wallet-${userId}`,
    });
    const wallet = res.data?.wallets?.[0];
    const address = wallet?.address as `0x${string}` | undefined;
    const id = wallet?.id;
    if (!address || !id) return null;
    return { address, circleWalletId: id };
  } catch {
    return null;
  }
}

/**
 * Each Supabase user gets one persistent RESOLVE app wallet (Circle if configured, else deterministic).
 * External wallets are stored separately in scanWalletAddress — never overwrite the app wallet.
 */
export async function ensureAppWalletForUser(user: DbUser): Promise<DbUser> {
  const deterministic = embeddedWalletFor(user.id).toLowerCase();
  const meta = readMeta(user.taskMemoryJson);

  if (user.embeddedWallet && user.walletAddress) {
    return user;
  }

  if (
    user.walletAddress &&
    user.walletAddress.toLowerCase() !== deterministic &&
    !user.embeddedWallet
  ) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        scanWalletAddress: user.scanWalletAddress ?? user.walletAddress,
        walletAddress: deterministic,
        embeddedWallet: true,
        taskMemoryJson: writeMeta(user.taskMemoryJson, {
          provider: meta?.provider ?? "embedded",
          circleWalletId: meta?.circleWalletId,
        }),
      },
    });
  }

  if (user.walletAddress && user.embeddedWallet) {
    return user;
  }

  const circleWallet = await createCircleAppWallet(user.id);
  if (circleWallet) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        walletAddress: circleWallet.address.toLowerCase(),
        embeddedWallet: true,
        taskMemoryJson: writeMeta(user.taskMemoryJson, {
          provider: "circle",
          circleWalletId: circleWallet.circleWalletId,
        }),
      },
    });
  }

  return prisma.user.update({
    where: { id: user.id },
    data: {
      walletAddress: deterministic,
      embeddedWallet: true,
      taskMemoryJson: writeMeta(user.taskMemoryJson, { provider: "embedded" }),
    },
  });
}

export function appWalletProvider(user: DbUser): "circle" | "embedded" {
  return readMeta(user.taskMemoryJson)?.provider ?? "embedded";
}
