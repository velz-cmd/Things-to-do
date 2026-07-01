import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";
import { resolvePayeeIdentities, type PayeeIdentity } from "@/lib/earn/summary";
import { normalizeGithubLogin } from "@/lib/identity/github-login";
import { normalizeListenBrainzUsername } from "@/lib/identity/listenbrainz-login";

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

/** Ledger payee keys — only from explicit connector fields, never mixed display names. */
export async function resolveClaimIdentities(input: {
  profile: Pick<
    User,
    "githubUsername" | "listenbrainzUsername" | "walletAddress" | "scanWalletAddress"
  >;
}): Promise<PayeeIdentity[]> {
  const sanitizedProfile = {
    ...input.profile,
    githubUsername: normalizeGithubLogin(input.profile.githubUsername),
    listenbrainzUsername: normalizeListenBrainzUsername(input.profile.listenbrainzUsername),
  };

  const base = resolvePayeeIdentities(sanitizedProfile);
  const seen = new Set(base.map((i) => `${i.payeeKeyType}:${i.payeeKey.toLowerCase()}`));
  const identities = [...base];

  function add(payeeKeyType: string, payeeKey: string, label: string) {
    const key = `${payeeKeyType}:${payeeKey.toLowerCase()}`;
    if (!payeeKey.trim() || seen.has(key)) return;
    seen.add(key);
    identities.push({ payeeKeyType, payeeKey: payeeKey.toLowerCase(), label });
  }

  const gh = sanitizedProfile.githubUsername?.toLowerCase();
  const wallet =
    sanitizedProfile.walletAddress?.toLowerCase() ??
    sanitizedProfile.scanWalletAddress?.toLowerCase();

  const registryOr: Array<Record<string, string>> = [];
  if (gh) registryOr.push({ githubUsername: gh });
  if (wallet) registryOr.push({ walletAddress: wallet });

  if (registryOr.length && gh) {
    try {
      const rows = await prisma.contributorRegistry.findMany({
        where: { OR: registryOr },
        select: { githubUsername: true },
      });

      for (const row of rows) {
        if (row.githubUsername?.toLowerCase() === gh) {
          add("github_username", row.githubUsername, `@${row.githubUsername}`);
        }
      }
    } catch {
      /* registry unavailable — base identities still valid */
    }
  }

  return identities;
}

export { isMusicPayeeType, MUSIC_PAYEE_PREFIXES };
