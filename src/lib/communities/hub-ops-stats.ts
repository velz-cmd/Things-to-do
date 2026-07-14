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
  resolvedIdentityCount: number;
  unresolvedIdentityCount: number;
  simulationComplete: boolean;
  settlementReady: boolean;
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
  const [resolvedIdentities, blueprints] = await Promise.all([
    prisma.observedIdentity.findMany({
      where: { userId, communitySlug: slug, status: "resolved" },
      select: { externalRef: true },
    }),
    prisma.blueprint.findMany({
      where: { userId, communitySlug: slug },
      select: { id: true },
    }),
  ]);
  const resolvedRefs = new Set(resolvedIdentities.map((row) => row.externalRef));
  const resolvedIdentityCount = [...builders].filter((builder) => resolvedRefs.has(builder)).length;
  const simulationComplete = blueprints.length > 0 && await prisma.simulation.count({
    where: { blueprintId: { in: blueprints.map((row) => row.id) }, status: "completed" },
  }) > 0;
  const unresolvedIdentityCount = Math.max(0, builders.size - resolvedIdentityCount);
  const settlementReady = pendingCount > 0 && unresolvedIdentityCount === 0 && simulationComplete && treasuryUsd >= pendingObligationsUsd;

  return {
    programCount: programs.length,
    treasuryUsd: Math.round(treasuryUsd * 100) / 100,
    pendingObligationsUsd: Math.round(pendingObligationsUsd * 100) / 100,
    pendingCount,
    builderCount: builders.size,
    resolvedIdentityCount,
    unresolvedIdentityCount,
    simulationComplete,
    settlementReady,
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
      resolvedIdentityCount: 0,
      unresolvedIdentityCount: 0,
      simulationComplete: false,
      settlementReady: false,
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

  const [resolvedRows, blueprintRows] = await Promise.all([
    prisma.observedIdentity.findMany({
      where: { userId, communitySlug: { in: installs.map((install) => install.communitySlug) }, status: "resolved" },
      select: { communitySlug: true, externalRef: true },
    }),
    prisma.blueprint.findMany({
      where: { userId, communitySlug: { in: installs.map((install) => install.communitySlug) } },
      select: { id: true, communitySlug: true },
    }),
  ]);
  const simulations = blueprintRows.length
    ? await prisma.simulation.findMany({
        where: { blueprintId: { in: blueprintRows.map((row) => row.id) }, status: "completed" },
        select: { blueprintId: true },
      })
    : [];
  const simulatedBlueprints = new Set(simulations.map((row) => row.blueprintId));
  const simulatedSlugs = new Set(
    blueprintRows.filter((row) => simulatedBlueprints.has(row.id)).flatMap((row) => row.communitySlug ? [row.communitySlug] : []),
  );
  const resolvedBySlug = new Map<string, Set<string>>();
  for (const row of resolvedRows) {
    const refs = resolvedBySlug.get(row.communitySlug) ?? new Set<string>();
    refs.add(row.externalRef);
    resolvedBySlug.set(row.communitySlug, refs);
  }
  for (const [slug, stats] of Object.entries(out)) {
    const builders = buildersBySlug.get(slug) ?? new Set<string>();
    const resolved = resolvedBySlug.get(slug) ?? new Set<string>();
    stats.resolvedIdentityCount = [...builders].filter((builder) => resolved.has(builder)).length;
    stats.unresolvedIdentityCount = Math.max(0, stats.builderCount - stats.resolvedIdentityCount);
    stats.simulationComplete = simulatedSlugs.has(slug);
    stats.settlementReady = stats.pendingCount > 0 && stats.unresolvedIdentityCount === 0 && stats.simulationComplete && stats.treasuryUsd >= stats.pendingObligationsUsd;
  }

  return out;
}
