import { keccak256, toBytes } from "viem";

/** Deterministic embedded wallet per user — invisible to email-only users. */
export function embeddedWalletFor(userId: string): `0x${string}` {
  const hash = keccak256(toBytes(`resolve-embedded:${userId}`));
  return `0x${hash.slice(-40)}` as `0x${string}`;
}
