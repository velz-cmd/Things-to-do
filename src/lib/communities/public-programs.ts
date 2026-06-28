import { prisma } from "@/lib/db";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { measureProgramOutcomes } from "@/lib/communities/measure-learn";

/** Public read — aggregate active programs across installs (no PII). */
export async function listPublicCapitalPrograms() {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  const programs = await prisma.resolveProgram.findMany({
    where: { status: { in: ["active", "deployed"] }, missionId: { not: null } },
    include: { install: { select: { communitySlug: true } } },
    orderBy: { updatedAt: "desc" },
    take: 24,
  });

  const out = [];
  for (const p of programs) {
    const communitySlug = p.install?.communitySlug ?? "unknown";
    const community = getCommunityBySlug(communitySlug);
    const measure = await measureProgramOutcomes(p.userId, p.id).catch(() => null);

    out.push({
      id: p.id,
      name: p.name,
      communitySlug,
      communityName: community?.name ?? communitySlug,
      status: p.status,
      budgetUsd: p.budgetUsd,
      missionId: p.missionId,
      templateId: p.templateId,
      measure: measure
        ? {
            authorizedUsd: measure.metrics.authorizedUsd,
            settledUsd: measure.metrics.settledUsd,
            playCount: measure.metrics.playCount,
            settlementRate: measure.metrics.settlementRate,
          }
        : null,
    });
  }

  return out;
}
