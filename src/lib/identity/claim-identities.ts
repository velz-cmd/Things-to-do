import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { resolvePayeeIdentities, type PayeeIdentity } from "@/lib/earn/summary";

const MUSIC_PAYEE_PREFIXES = [
  "listen_artist",
  "listen_composer",
  "listen_writer",
  "listen_producer",
  "listen_conductor",
  "listen_publisher",
  "listen_credit",
] as const;

function isMusicPayeeType(payeeKeyType: string) {
  return MUSIC_PAYEE_PREFIXES.some((p) => p === payeeKeyType);
}

/** All ledger payee keys a signed-in user may claim — GitHub, wallet, ListenBrainz, registry names. */
export async function resolveClaimIdentities(input: {
  profile: Pick<
    User,
    "githubUsername" | "listenbrainzUsername" | "walletAddress" | "scanWalletAddress"
  >;
  authUser?: SupabaseUser | null;
}): Promise<PayeeIdentity[]> {
  const base = resolvePayeeIdentities(input.profile, input.authUser);
  const seen = new Set(base.map((i) => `${i.payeeKeyType}:${i.payeeKey.toLowerCase()}`));
  const identities = [...base];

  function add(payeeKeyType: string, payeeKey: string, label: string) {
    const key = `${payeeKeyType}:${payeeKey.toLowerCase()}`;
    if (!payeeKey.trim() || seen.has(key)) return;
    seen.add(key);
    identities.push({ payeeKeyType, payeeKey: payeeKey.toLowerCase(), label });
  }

  const gh =
    input.profile.githubUsername?.toLowerCase() ??
    base.find((i) => i.payeeKeyType === "github_username")?.payeeKey;

  const wallet =
    input.profile.walletAddress?.toLowerCase() ??
    input.profile.scanWalletAddress?.toLowerCase() ??
    base.find((i) => i.payeeKeyType === "wallet")?.payeeKey;

  const registryOr: Array<Record<string, string>> = [];
  if (gh) registryOr.push({ githubUsername: gh });
  if (wallet) registryOr.push({ walletAddress: wallet });

  if (registryOr.length) {
    const rows = await prisma.contributorRegistry.findMany({
      where: { OR: registryOr },
      select: {
        creatorName: true,
        exifArtist: true,
        githubUsername: true,
        walletAddress: true,
      },
    });

    for (const row of rows) {
      if (row.githubUsername) {
        add("github_username", row.githubUsername, `@${row.githubUsername}`);
      }
      if (row.creatorName) {
        add("listen_artist", row.creatorName, row.creatorName);
      }
      if (row.exifArtist && row.exifArtist !== row.creatorName) {
        add("listen_artist", row.exifArtist, row.exifArtist);
      }
    }
  }

  return identities;
}

export { isMusicPayeeType, MUSIC_PAYEE_PREFIXES };
