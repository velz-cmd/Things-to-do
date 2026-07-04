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
    select: {
      communitySlug: true,
      programs: {
        select: {
          missionId: true,
          budgetUsd: true,
        },
      },
    },
  });

  const missionToSlug = new Map<string, string>();
  const out: Record<string, CommunityHubOpsStats> = {};

  for (const install of installs) {
    let treasuryUsd = 0;
    for (const program of install.programs) {
      treasuryUsd += program.budgetUsd;
      if (program.missionId) missionToSlug.set(program.missionId, install.communitySlug);
    }
    out[install.communitySlug] = {
      programCount: install.programs.length,
      treasuryUsd: Math.round(treasuryUsd * 100) / 100,
      pendingObligationsUsd: 0,
      pendingCount: 0,
      builderCount: 0,
    };
  }

  const missionIds = [...missionToSlug.keys()];
  const authRows = missionIds.length
    ? await prisma.paymentAuthorization.findMany({
        where: {
          missionId: { in: missionIds },
          status: { in: [...PENDING_STATUSES] },
        },
        select: {
          missionId: true,
          payeeKey: true,
          amountUsd: true,
        },
      })
    : [];

  const buildersBySlug = new Map<string, Set<string>>();
  for (const auth of authRows) {
    const slug = missionToSlug.get(auth.missionId);
    if (!slug || !out[slug]) continue;
    out[slug].pendingObligationsUsd += auth.amountUsd;
    out[slug].pendingCount += 1;
    const builders = buildersBySlug.get(slug) ?? new Set<string>();
    builders.add(auth.payeeKey);
    buildersBySlug.set(slug, builders);
  }

  for (const [slug, stats] of Object.entries(out)) {
    stats.pendingObligationsUsd = Math.round(stats.pendingObligationsUsd * 100) / 100;
    stats.builderCount = buildersBySlug.get(slug)?.size ?? 0;
  }

  return out;
}
