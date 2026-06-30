import type { User as DbUser } from "@prisma/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { embeddedWalletFor } from "@/lib/wallet/embedded";
import { appWalletProvider } from "@/lib/wallet/app-wallet-service";

export type WalletSource =
  | "circle_embedded"
  | "external_wallet"
  | "profile"
  | "server_wallet";

export type ResolvedUserWallet = {
  address: `0x${string}`;
  source: WalletSource;
  externalAddress?: `0x${string}`;
};

function normalize(addr: string): `0x${string}` {
  return addr.trim().toLowerCase() as `0x${string}`;
}

/**
 * Single canonical RESOLVE wallet resolver — used by Capital, profile, and banking.
 * Embedded wallets always resolve to embeddedWalletFor(userId) so they match the profile menu.
 * Circle wallets use the persisted Circle address from the database.
 */
export function resolveUserWallet(
  userId: string,
  profile?: Pick<
    DbUser,
    "walletAddress" | "scanWalletAddress" | "embeddedWallet" | "taskMemoryJson"
  > | null,
  _session?: Pick<SupabaseUser, "id"> | null,
): ResolvedUserWallet {
  const deterministic = embeddedWalletFor(userId);
  const external =
    profile?.scanWalletAddress?.trim() ?
      normalize(profile.scanWalletAddress)
    : undefined;

  if (profile?.walletAddress?.trim() && profile.embeddedWallet) {
    const provider = appWalletProvider(profile as DbUser);
    if (provider === "circle") {
      return {
        address: normalize(profile.walletAddress),
        source: "circle_embedded",
        externalAddress: external,
      };
    }
    return {
      address: deterministic,
      source: "server_wallet",
      externalAddress: external,
    };
  }

  if (profile?.walletAddress?.trim()) {
    return {
      address: normalize(profile.walletAddress),
      source: "profile",
      externalAddress: external,
    };
  }

  return {
    address: deterministic,
    source: "server_wallet",
    externalAddress: external,
  };
}

export function shortWalletAddress(address: string): string {
  const a = address.trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** @deprecated use resolveUserWallet */
export function resolveIdentityWalletAddress(
  userId: string,
  profile?: Pick<DbUser, "walletAddress" | "scanWalletAddress" | "embeddedWallet" | "taskMemoryJson"> | null,
): `0x${string}` {
  return resolveUserWallet(userId, profile).address;
}
