import { prisma } from "@/lib/db";
import { DEMO_CONTRIBUTORS } from "@/lib/registry/seed-data";

export async function seedContributorRegistry(): Promise<number> {
  let count = 0;
  for (const c of DEMO_CONTRIBUTORS) {
    const existing = await prisma.contributorRegistry.findFirst({
      where: {
        platform: c.platform,
        platformId: c.platformId,
      },
    });
    if (existing) continue;

    await prisma.contributorRegistry.create({
      data: {
        platform: c.platform,
        platformId: c.platformId,
        creatorName: c.creatorName,
        walletAddress: c.walletAddress,
        githubUsername: "githubUsername" in c ? c.githubUsername : null,
        musicbrainzId: "musicbrainzId" in c ? c.musicbrainzId : null,
        exifArtist: "exifArtist" in c ? c.exifArtist : null,
        activitypubActor: "activitypubActor" in c ? c.activitypubActor : null,
        verified: true,
      },
    });
    count++;
  }
  return count;
}
