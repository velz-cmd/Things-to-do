import { prisma } from "@/lib/db";
import { communityLinkedViaProfile } from "@/lib/discover/community-profile-link";
import { getUserConnectionState } from "@/lib/profile/connection-state";
import { installCommunity, getInstall } from "@/lib/communities/installs";

const PROFILE_SELECT = {
  githubUsername: true,
  listenbrainzUsername: true,
  jellyfinUrl: true,
  jellyfinUsername: true,
  jellyfinAccessToken: true,
  jellyfinPassword: true,
  navidromeUrl: true,
  navidromeUsername: true,
  navidromePassword: true,
  gmailConnected: true,
  walletAddress: true,
  scanWalletAddress: true,
  updatedAt: true,
} as const;

/**
 * When Profile already links upstream sources for a community, ensure the DB install row
 * exists without asking the user to "Install RESOLVE" again on Communities/Discover.
 */
export async function ensureProfileLinkedInstall(
  userId: string,
  communitySlug: string,
): Promise<boolean> {
  const existing = await getInstall(userId, communitySlug);
  if (existing) return true;

  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: PROFILE_SELECT,
  });
  if (!profile) return false;

  const state = await getUserConnectionState({
    userId,
    profile,
    walletAddress:
      profile.scanWalletAddress?.toLowerCase() ??
      profile.walletAddress?.toLowerCase() ??
      undefined,
  });

  if (!communityLinkedViaProfile(communitySlug, state)) return false;

  const result = await installCommunity(userId, communitySlug);
  return result.ok;
}
