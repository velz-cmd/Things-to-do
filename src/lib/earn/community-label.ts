import { prisma } from "@/lib/db";
import { COMMUNITY_CATALOG, getCommunityBySlug } from "@/lib/communities/catalog";

/** Human community name for a mission — used in earn emails and public receipts. */
export async function communityLabelForMission(missionId: string): Promise<{
  communityName: string;
  communitySlug?: string;
  programName?: string;
}> {
  const program = await prisma.resolveProgram.findFirst({
    where: { missionId },
    include: { install: { select: { communitySlug: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const communitySlug = program?.install?.communitySlug;
  if (communitySlug) {
    const community = getCommunityBySlug(communitySlug);
    return {
      communityName: community?.name ?? program?.name ?? communitySlug,
      communitySlug,
      programName: program?.name ?? undefined,
    };
  }

  for (const entry of COMMUNITY_CATALOG) {
    if (missionId.includes(entry.slug)) {
      return {
        communityName: entry.name,
        communitySlug: entry.slug,
        programName: program?.name ?? undefined,
      };
    }
  }

  if (program?.name) {
    return { communityName: program.name, programName: program.name };
  }

  return { communityName: missionId };
}
