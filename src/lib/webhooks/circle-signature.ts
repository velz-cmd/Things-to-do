import "server-only";

import { createPublicKey, verify } from "node:crypto";

type CirclePublicKeyResponse = {
  data?: {
    id?: string;
    algorithm?: string;
    publicKey?: string;
  };
};

const keyCache = new Map<string, { publicKey: string; expiresAt: number }>();

async function getCircleNotificationPublicKey(keyId: string): Promise<string> {
  const cached = keyCache.get(keyId);
  if (cached && cached.expiresAt > Date.now()) return cached.publicKey;

  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  if (!apiKey) throw new Error("Circle webhook verification is not configured.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(
      `https://api.circle.com/v2/notifications/publicKey/${encodeURIComponent(keyId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error(`Circle public key lookup failed (${response.status}).`);
    const body = (await response.json()) as CirclePublicKeyResponse;
    const publicKey = body.data?.publicKey;
    if (!publicKey) throw new Error("Circle public key response was incomplete.");
    keyCache.set(keyId, { publicKey, expiresAt: Date.now() + 60 * 60_000 });
    return publicKey;
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyCircleWebhookSignature(input: {
  rawBody: string;
  keyId: string;
  signature: string;
}): Promise<boolean> {
  const encodedPublicKey = await getCircleNotificationPublicKey(input.keyId);
  const key = createPublicKey({
    key: Buffer.from(encodedPublicKey, "base64"),
    format: "der",
    type: "spki",
  });
  return verify(
    "sha256",
    Buffer.from(input.rawBody, "utf8"),
    key,
    Buffer.from(input.signature, "base64"),
  );
}
