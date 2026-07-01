import { prisma } from "@/lib/db";
import type { User as DbUser } from "@prisma/client";
import { embeddedWalletFor } from "@/lib/wallet/embedded";
import { getCircleClient, getCircleClientWithSecret, resetCircleClientCache } from "@/lib/settlement/circle-client";
import {
  CIRCLE_WALLET_SET_CONFIG_KEY,
  ensureCircleEntitySecret,
  ensureCircleWalletSet,
  getCircleWalletSetId,
} from "@/lib/wallet/circle-config";
import { circleErrorMessage } from "@/lib/wallet/circle-errors";
import { circleIdempotencyKey } from "@/lib/wallet/circle-idempotency";

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

async function resolveWalletSetCandidates(): Promise<string[]> {
  const candidates: string[] = [];
  const fromEnv = process.env.CIRCLE_WALLET_SET_ID?.trim();
  if (fromEnv) candidates.push(fromEnv);

  const resolved = await getCircleWalletSetId();
  if (resolved && !candidates.includes(resolved)) candidates.push(resolved);

  const row = await prisma.appConfig.findUnique({
    where: { key: CIRCLE_WALLET_SET_CONFIG_KEY },
  });
  const fromDb = row?.value?.trim();
  if (fromDb && !candidates.includes(fromDb)) candidates.push(fromDb);

  if (!candidates.length) {
    const boot = await ensureCircleWalletSet();
    candidates.push(boot.walletSetId);
  }

  return candidates;
}

async function createCircleAppWallet(
  userId: string,
  options?: { throwOnError?: boolean },
): Promise<{
  address: `0x${string}`;
  circleWalletId: string;
} | null> {
  try {
    const secretResult = await ensureCircleEntitySecret();
    resetCircleClientCache();

    const circle = await getCircleClientWithSecret(secretResult.entitySecret);
    if (!circle) {
      const msg = "Circle client not configured (CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET)";
      if (options?.throwOnError) throw new Error(msg);
      return null;
    }

    const walletSetIds = await resolveWalletSetCandidates();
    let lastError: unknown = null;

    for (const walletSetId of walletSetIds) {
      try {
        const res = await circle.createWallets({
          walletSetId,
          blockchains: ["ARC-TESTNET"],
          count: 1,
          accountType: "EOA",
          idempotencyKey: circleIdempotencyKey(userId),
        });

        const wallet = res.data?.wallets?.[0];
        const address = wallet?.address as `0x${string}` | undefined;
        const id = wallet?.id;
        if (!address || !id) {
          throw new Error("Circle returned no wallet address");
        }
        return { address, circleWalletId: id };
      } catch (err) {
        lastError = err;
        if (walletSetIds.length === 1) throw err;
      }
    }

    throw lastError ?? new Error("Could not create wallet in any wallet set");
  } catch (err) {
    const msg = circleErrorMessage(err);
    if (options?.throwOnError) throw new Error(msg);
    console.error("[createCircleAppWallet]", userId, msg);
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
    const provider = appWalletProvider(user);
    if (provider === "circle" && circleWalletIdForUser(user)) {
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

    if (user.walletAddress.toLowerCase() !== deterministic) {
      return prisma.user.update({
        where: { id: user.id },
        data: {
          walletAddress: deterministic,
          taskMemoryJson: writeMeta(user.taskMemoryJson, {
            provider: "embedded",
            circleWalletId: meta?.circleWalletId,
          }),
        },
      });
    }
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

export function circleWalletIdForUser(user: DbUser): string | null {
  return readMeta(user.taskMemoryJson)?.circleWalletId ?? null;
}

/** Upgrade embedded RESOLVE wallet to a Circle Arc wallet for on-chain agent payments. */
export async function upgradeUserToCircleWallet(user: DbUser): Promise<DbUser> {
  if (appWalletProvider(user) === "circle" && circleWalletIdForUser(user)) {
    return user;
  }

  const circleWallet = await createCircleAppWallet(user.id, { throwOnError: true });
  if (!circleWallet) {
    throw new Error("Circle wallet creation failed");
  }

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
