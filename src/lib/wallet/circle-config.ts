import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import {
  isProductionRuntime,
  normalizeCircleEntitySecret,
} from "@/lib/wallet/circle-secret";

export { normalizeCircleEntitySecret } from "@/lib/wallet/circle-secret";

export const CIRCLE_WALLET_SET_CONFIG_KEY = "circle_wallet_set_id";
export const CIRCLE_ENTITY_SECRET_CONFIG_KEY = "circle_entity_secret";

export class CircleEntitySecretError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircleEntitySecretError";
  }
}

export async function getCircleEntitySecret(): Promise<string | null> {
  const fromEnv = normalizeCircleEntitySecret(process.env.CIRCLE_ENTITY_SECRET);
  if (fromEnv && /^[0-9a-f]{64}$/.test(fromEnv)) return fromEnv;

  const row = await prisma.appConfig.findUnique({
    where: { key: CIRCLE_ENTITY_SECRET_CONFIG_KEY },
  });
  const fromDb = normalizeCircleEntitySecret(row?.value);
  if (fromDb && /^[0-9a-f]{64}$/.test(fromDb)) return fromDb;

  return null;
}

/** Runtime path: normalized env (Vercel) first, then DB cache — no Circle register calls. */
export async function requireCircleEntitySecret(): Promise<string> {
  const secret = await getCircleEntitySecret();
  if (secret && /^[0-9a-f]{64}$/.test(secret)) {
    return secret;
  }

  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  if (!apiKey) {
    throw new CircleEntitySecretError(
      "Circle payments are not configured on this server.",
    );
  }

  throw new CircleEntitySecretError(
    "Circle entity secret is missing. Use your connected wallet to pay on Arc, or contact the operator.",
  );
}

export async function setCircleEntitySecret(entitySecret: string): Promise<void> {
  const normalized = normalizeCircleEntitySecret(entitySecret);
  if (!normalized) return;
  await prisma.appConfig.upsert({
    where: { key: CIRCLE_ENTITY_SECRET_CONFIG_KEY },
    create: { key: CIRCLE_ENTITY_SECRET_CONFIG_KEY, value: normalized },
    update: { value: normalized },
  });
}

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

function isCircleCredentialError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: number }).code;
  return code === 156013 || code === 156016;
}

async function registerEntitySecret(apiKey: string, entitySecret: string): Promise<void> {
  const { registerEntitySecretCiphertext } = await import(
    "@circle-fin/developer-controlled-wallets"
  );
  try {
    await registerEntitySecretCiphertext({ apiKey, entitySecret });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 156015) return;
    throw err;
  }
}

async function createCircleClient(apiKey: string, entitySecret: string) {
  const { initiateDeveloperControlledWalletsClient } = await import(
    "@circle-fin/developer-controlled-wallets"
  );
  return initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
}

/**
 * Resolve a working Circle entity secret: normalize env value, register if needed,
 * or generate a new secret when the configured value is invalid.
 */
export async function ensureCircleEntitySecret(): Promise<{
  entitySecret: string;
  normalizedFromEnv: boolean;
  generated: boolean;
}> {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  if (!apiKey) throw new Error("CIRCLE_API_KEY is not configured");

  const envRaw = process.env.CIRCLE_ENTITY_SECRET?.trim();
  const normalizedEnv = normalizeCircleEntitySecret(envRaw);
  const candidates: string[] = [];

  if (normalizedEnv) candidates.push(normalizedEnv);
  const stored = await getCircleEntitySecret();
  if (stored && !candidates.includes(stored)) candidates.push(stored);

  for (const candidate of candidates) {
    try {
      await registerEntitySecret(apiKey, candidate);
      await setCircleEntitySecret(candidate);
      return {
        entitySecret: candidate,
        normalizedFromEnv: Boolean(envRaw && normalizeCircleEntitySecret(envRaw) !== candidate),
        generated: false,
      };
    } catch (err) {
      if (!isCircleCredentialError(err)) throw err;
    }
  }

  if (isProductionRuntime()) {
    throw new CircleEntitySecretError(
      "CIRCLE_ENTITY_SECRET on Vercel does not match Circle. Copy the 64-char hex from Vercel or reset via recovery file — see docs/CIRCLE-SETUP.md.",
    );
  }

  const entitySecret = randomBytes(32).toString("hex");
  await registerEntitySecret(apiKey, entitySecret);
  await setCircleEntitySecret(entitySecret);
  return { entitySecret, normalizedFromEnv: false, generated: true };
}

export async function ensureCircleWalletSet(): Promise<{
  walletSetId: string;
  created: boolean;
  bootstrapWalletId: string | null;
  bootstrapAddress: string | null;
  entitySecretFix?: {
    normalizedFromEnv: boolean;
    generated: boolean;
    updateVercelEnv: boolean;
  };
}> {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  if (!apiKey) throw new Error("Circle API key is not configured");

  const existing = await getCircleWalletSetId();
  if (existing) {
    return {
      walletSetId: existing,
      created: false,
      bootstrapWalletId: null,
      bootstrapAddress: null,
    };
  }

  const secretResult = await ensureCircleEntitySecret();
  const circle = await createCircleClient(apiKey, secretResult.entitySecret);

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
    entitySecretFix:
      secretResult.normalizedFromEnv || secretResult.generated
        ? {
            normalizedFromEnv: secretResult.normalizedFromEnv,
            generated: secretResult.generated,
            updateVercelEnv: true,
          }
        : undefined,
  };
}
