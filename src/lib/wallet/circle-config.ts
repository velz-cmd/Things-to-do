import { prisma } from "@/lib/db";
import { getCircleClient } from "@/lib/settlement/circle-client";
import { hasCircleCredentials } from "@/lib/settlement/arc-config";

export const CIRCLE_WALLET_SET_CONFIG_KEY = "circle_wallet_set_id";

export async function getCircleWalletSetId(): Promise<string | null> {
  const fromEnv = process.env.CIRCLE_WALLET_SET_ID?.trim();
  if (fromEnv) return fromEnv;

  const row = await prisma.appConfig.findUnique({
    where: { key: CIRCLE_WALLET_SET_CONFIG_KEY },
  });
  return row?.value?.trim() || null;
}

export async function setCircleWalletSetId(walletSetId: string): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key: CIRCLE_WALLET_SET_CONFIG_KEY },
    create: { key: CIRCLE_WALLET_SET_CONFIG_KEY, value: walletSetId },
    update: { value: walletSetId },
  });
}

export async function ensureCircleWalletSet(): Promise<{
  walletSetId: string;
  created: boolean;
  bootstrapWalletId: string | null;
  bootstrapAddress: string | null;
}> {
  if (!hasCircleCredentials()) {
    throw new Error("Circle credentials are not configured");
  }

  const existing = await getCircleWalletSetId();
  if (existing) {
    return {
      walletSetId: existing,
      created: false,
      bootstrapWalletId: null,
      bootstrapAddress: null,
    };
  }

  const circle = await getCircleClient();
  if (!circle) {
    throw new Error("Failed to initialize Circle client");
  }

  const walletSetResponse = await circle.createWalletSet({
    name: "RESOLVE App Wallets",
  });
  const walletSetId = walletSetResponse.data?.walletSet?.id;
  if (!walletSetId) {
    throw new Error("Wallet set creation failed: no ID returned");
  }

  const walletResponse = await circle.createWallets({
    walletSetId,
    blockchains: ["ARC-TESTNET"],
    count: 1,
    accountType: "EOA",
    idempotencyKey: "resolve-bootstrap-wallet-001",
  });
  const bootstrap = walletResponse.data?.wallets?.[0];

  await setCircleWalletSetId(walletSetId);

  return {
    walletSetId,
    created: true,
    bootstrapWalletId: bootstrap?.id ?? null,
    bootstrapAddress: bootstrap?.address ?? null,
  };
}
