import { createHash, randomUUID } from "crypto";

/** Circle mutating APIs require a UUID v4 idempotency key. */
const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: string): boolean {
  return UUID_V4_RE.test(value.trim());
}

/**
 * Stable UUID v4 for Circle idempotency — same seed always yields the same key.
 * Use userId directly when it is already UUID v4.
 */
export function circleIdempotencyKey(seed: string): string {
  const trimmed = seed.trim();
  if (isUuidV4(trimmed)) return trimmed.toLowerCase();

  const hash = createHash("sha256").update(`resolve-circle:${trimmed}`).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x40;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function circleIdempotencyKeyRandom(): string {
  return randomUUID();
}
