import { installCommunity } from "@/lib/communities/installs";

const MUSIC_SLUGS = ["independent-music"] as const;
const OSS_SLUGS = ["react", "linux"] as const;

/** Attach featured communities when the user connects the matching identity — idempotent. */
export async function autoInstallCommunitiesForUser(
  userId: string,
  profile: {
    githubUsername?: string | null;
    listenbrainzUsername?: string | null;
  },
) {
  const slugs = new Set<string>();

  if (profile.listenbrainzUsername?.trim()) {
    for (const slug of MUSIC_SLUGS) slugs.add(slug);
  }
  if (profile.githubUsername?.trim()) {
    for (const slug of OSS_SLUGS) slugs.add(slug);
  }

  const installed: string[] = [];
  for (const slug of slugs) {
    const result = await installCommunity(userId, slug);
    if (result.ok) installed.push(slug);
  }

  return { installed };
}
