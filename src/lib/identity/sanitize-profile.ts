import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";
import { normalizeGithubLogin } from "@/lib/identity/github-login";
import { normalizeListenBrainzUsername } from "@/lib/identity/listenbrainz-login";

/** Clear invalid connector usernames (display names, spaces) stored by old flows. */
export async function sanitizeConnectorIdentities(
  userId: string,
  profile: User,
): Promise<User> {
  const data: Partial<User> = {};

  const gh = normalizeGithubLogin(profile.githubUsername);
  if (profile.githubUsername && gh !== profile.githubUsername) {
    data.githubUsername = gh;
    if (!gh) data.githubId = null;
  }

  const lb = normalizeListenBrainzUsername(profile.listenbrainzUsername);
  if (profile.listenbrainzUsername && lb !== profile.listenbrainzUsername) {
    data.listenbrainzUsername = lb;
  }

  if (!Object.keys(data).length) return profile;

  return prisma.user.update({
    where: { id: userId },
    data,
  });
}
