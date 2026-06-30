import type { User as DbUser } from "@prisma/client";
import { embeddedWalletFor } from "@/lib/wallet/embedded";

/** Canonical spend/deposit address — matches what the client shows in the profile menu. */
export function resolveIdentityWalletAddress(
  userId: string,
  profile: Pick<DbUser, "walletAddress" | "scanWalletAddress"> | null | undefined,
): `0x${string}` {
  const raw =
    profile?.walletAddress?.trim() ||
    profile?.scanWalletAddress?.trim() ||
    embeddedWalletFor(userId);
  return raw.toLowerCase() as `0x${string}`;
}
