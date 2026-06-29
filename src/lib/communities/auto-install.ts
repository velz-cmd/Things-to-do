import { installCommunity } from "@/lib/communities/installs";
import { communitiesForTrack } from "@/lib/connectors/phase3-tracks";

const MUSIC_SLUGS = communitiesForTrack("music");
const OSS_SLUGS = communitiesForTrack("oss");
const RESEARCH_SLUGS = communitiesForTrack("research");
const MEDIA_SLUGS = communitiesForTrack("media");

/** Attach featured communities when the user connects the matching identity — idempotent. */
export async function autoInstallCommunitiesForUser(
  userId: string,
  profile: {
    githubUsername?: string | null;
    listenbrainzUsername?: string | null;
    navidromeUrl?: string | null;
    navidromeUsername?: string | null;
    navidromePassword?: string | null;
    jellyfinUrl?: string | null;
    jellyfinUsername?: string | null;
    jellyfinAccessToken?: string | null;
  },
) {
  const slugs = new Set<string>();

  if (profile.listenbrainzUsername?.trim()) {
    for (const slug of MUSIC_SLUGS) slugs.add(slug);
    for (const slug of RESEARCH_SLUGS) slugs.add(slug);
  }

  const navidromeReady =
    profile.navidromeUrl?.trim() &&
    profile.navidromeUsername?.trim() &&
    profile.navidromePassword?.trim();
  if (navidromeReady) {
    slugs.add("navidrome");
    slugs.add("independent-music");
  }

  const jellyfinReady =
    profile.jellyfinUrl?.trim() && profile.jellyfinAccessToken?.trim();
  if (jellyfinReady) {
    slugs.add("jellyfin");
  }

  if (profile.githubUsername?.trim()) {
    for (const slug of OSS_SLUGS) slugs.add(slug);
    for (const slug of RESEARCH_SLUGS) slugs.add(slug);
  }

  const installed: string[] = [];
  for (const slug of slugs) {
    const result = await installCommunity(userId, slug);
    if (result.ok) installed.push(slug);
  }

  return { installed };
}
