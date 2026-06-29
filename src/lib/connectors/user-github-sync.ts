import { prisma } from "@/lib/db";
import { syncGithubCommunitySensors, syncOpenAlexCommunitySensors } from "@/lib/sensors/sync";

const OSS_COMMUNITIES = ["react", "linux"] as const;

/** Per-user GitHub sensors — public API, no operator token required. */
export async function syncUserGithubSensors(userId: string) {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { githubUsername: true },
  });

  if (!profile?.githubUsername?.trim()) {
    return { ok: false as const, reason: "github_not_connected", ingested: 0, communities: 0 };
  }

  const installs = await prisma.resolveCommunityInstall.findMany({
    where: {
      userId,
      communitySlug: { in: [...OSS_COMMUNITIES] },
    },
    select: { communitySlug: true },
  });

  if (!installs.length) {
    return { ok: true as const, ingested: 0, communities: 0, skipped: "no_oss_installs" };
  }

  let ingested = 0;
  const details: Array<{ communitySlug: string; ingested: number }> = [];

  for (const install of installs) {
    const result = await syncGithubCommunitySensors({
      communitySlug: install.communitySlug,
      founderUserId: userId,
    });
    ingested += result.ingested;
    details.push({ communitySlug: install.communitySlug, ingested: result.ingested });
  }

  return { ok: true as const, ingested, communities: installs.length, details };
}

/** Per-user research sensors — OpenAlex public API. */
export async function syncUserOpenAlexSensors(userId: string) {
  const install = await prisma.resolveCommunityInstall.findFirst({
    where: { userId, communitySlug: "open-research" },
    select: { communitySlug: true },
  });

  if (!install) {
    return { ok: true as const, ingested: 0, skipped: "no_research_install" };
  }

  const result = await syncOpenAlexCommunitySensors({
    communitySlug: "open-research",
    founderUserId: userId,
  });

  return {
    ok: true as const,
    ingested: result.ingested,
    observations: result.observations,
  };
}

export async function syncAllUsersGithubSensors(limit = 40) {
  const users = await prisma.user.findMany({
    where: {
      githubUsername: { not: null },
      communityInstalls: { some: { communitySlug: { in: [...OSS_COMMUNITIES] } } },
    },
    select: { id: true },
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  const results = [];
  for (const u of users) {
    results.push({ userId: u.id, ...(await syncUserGithubSensors(u.id)) });
  }

  return {
    ok: true as const,
    users: users.length,
    totalIngested: results.reduce((s, r) => s + (r.ingested ?? 0), 0),
    results,
  };
}

export async function syncAllUsersOpenAlexSensors(limit = 40) {
  const users = await prisma.resolveCommunityInstall.findMany({
    where: { communitySlug: "open-research" },
    select: { userId: true },
    distinct: ["userId"],
    take: limit,
    orderBy: { installedAt: "desc" },
  });

  const results = [];
  for (const row of users) {
    results.push({ userId: row.userId, ...(await syncUserOpenAlexSensors(row.userId)) });
  }

  return {
    ok: true as const,
    users: users.length,
    totalIngested: results.reduce((s, r) => s + (r.ingested ?? 0), 0),
    results,
  };
}
