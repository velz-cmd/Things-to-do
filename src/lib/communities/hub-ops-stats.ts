import { prisma } from "@/lib/db";
import { getInstall } from "@/lib/communities/installs";
import { listProgramsForCommunity } from "@/lib/communities/programs";
import { getAuthorizationSummary } from "@/lib/authorization/ledger";

const PENDING_STATUSES = new Set(["authorized", "pending_funding"]);

export type CommunityHubOpsStats = {
  programCount: number;
  treasuryUsd: number;
  pendingObligationsUsd: number;
  pendingCount: number;
  builderCount: number;
};

/** Per-user ops stats for hub console cards — ledger-backed, not catalog estimates. */
export async function buildUserCommunityHubOps(
  userId: string,
  slug: string,
): Promise<CommunityHubOpsStats | null> {
  const install = await getInstall(userId, slug);
  if (!install) return null;

  const programs = await listProgramsForCommunity(userId, slug);
  const missionIds = programs.map((p) => p.missionId).filter(Boolean) as string[];

  let pendingObligationsUsd = 0;
  let pendingCount = 0;
  const builders = new Set<string>();

  if (missionIds.length > 0) {
    const summaries = await Promise.all(
      missionIds.map((missionId) => getAuthorizationSummary({ missionId })),
    );
    for (const summary of summaries) {
      for (const a of summary.authorizations) {
        if (PENDING_STATUSES.has(a.status)) {
          pendingObligationsUsd += a.amountUsd;
          pendingCount += 1;
          builders.add(a.payeeKey);
        }
      }
    }
  }

  const treasuryUsd = programs.reduce((s, p) => s + p.budgetUsd, 0);

  return {
    programCount: programs.length,
    treasuryUsd: Math.round(treasuryUsd * 100) / 100,
    pendingObligationsUsd: Math.round(pendingObligationsUsd * 100) / 100,
    pendingCount,
    builderCount: builders.size,
  };
}

export async function buildUserHubOpsMap(
  userId: string,
): Promise<Record<string, CommunityHubOpsStats>> {
  const installs = await prisma.resolveCommunityInstall.findMany({
    where: { userId },
    select: { communitySlug: true },
  });

  const entries = await Promise.all(
    installs.map(async (i) => {
      const stats = await buildUserCommunityHubOps(userId, i.communitySlug);
      return [i.communitySlug, stats] as const;
    }),
  );

  const out: Record<string, CommunityHubOpsStats> = {};
  for (const [slug, stats] of entries) {
    if (stats) out[slug] = stats;
  }
  return out;
}
