import { createHmac, timingSafeEqual } from "crypto";

export type ClaimTokenPayload = {
  v: 1;
  payeeKeyType: string;
  payeeKey: string;
  authorizationIds: string[];
  amountUsd: number;
  exp: number;
};

const TOKEN_TTL_SEC = 60 * 60 * 24 * 14;

function secret(): string {
  const s =
    process.env.CLAIM_TOKEN_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!s) throw new Error("CLAIM_TOKEN_SECRET or CRON_SECRET required for claim tokens");
  return s;
}

function b64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString(
    "utf8",
  );
}

export function createClaimToken(
  input: Omit<ClaimTokenPayload, "v" | "exp"> & { ttlSec?: number },
): string {
  const payload: ClaimTokenPayload = {
    v: 1,
    payeeKeyType: input.payeeKeyType,
    payeeKey: input.payeeKey.toLowerCase(),
    authorizationIds: input.authorizationIds,
    amountUsd: Math.round(input.amountUsd * 100) / 100,
    exp: Math.floor(Date.now() / 1000) + (input.ttlSec ?? TOKEN_TTL_SEC),
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyClaimToken(token: string): ClaimTokenPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = b64url(createHmac("sha256", secret()).update(body).digest());
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(fromB64url(body)) as ClaimTokenPayload;
    if (payload.v !== 1) return null;
    if (!payload.payeeKeyType || !payload.payeeKey) return null;
    if (!Array.isArray(payload.authorizationIds)) return null;
    if (typeof payload.amountUsd !== "number" || payload.amountUsd <= 0) return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      ...payload,
      payeeKey: payload.payeeKey.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function claimUrlForToken(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/claim?token=${encodeURIComponent(token)}`;
}
