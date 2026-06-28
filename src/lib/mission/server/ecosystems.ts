import { prisma } from "@/lib/db";
import { scanFundingOpportunity, RADAR_TARGETS } from "@/lib/github/opportunities";
import { getConnectorLiveStatuses } from "@/lib/connectors/live-stats";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";

export type EcosystemRepo = {
  owner: string;
  repo: string;
  fullName: string;
  stars?: number;
  fundingGapUsd?: number;
  maintainerCount?: number;
};

export type EcosystemRecord = {
  id: string;
  name: string;
  kind: string;
  keywords: string[];
  repos: EcosystemRepo[];
  connectors: string[];
  missionCount: number;
  createdAt: string;
  updatedAt: string;
};

const SEED_ECOSYSTEMS = [
  { name: "AI Infrastructure", kind: "oss", keywords: ["ai", "llm", "langchain", "ml ops"] },
  { name: "React", kind: "oss", keywords: ["react", "next.js", "nextjs"] },
  { name: "Linux", kind: "oss", keywords: ["linux", "kernel", "gnome", "fedora", "arch"] },
  { name: "Ethereum", kind: "protocol", keywords: ["ethereum", "eth", "evm"] },
  { name: "Solana", kind: "protocol", keywords: ["solana", "sol"] },
  { name: "Independent Music", kind: "music", keywords: ["music", "artist", "listenbrainz", "royalty"] },
  { name: "Navidrome", kind: "music", keywords: ["navidrome", "music", "scrobble", "self-hosted"] },
  { name: "Open Education", kind: "education", keywords: ["education", "course", "teaching"] },
  { name: "Digital Commons", kind: "general", keywords: ["commons", "creative commons", "open access"] },
  { name: "Pakistan OSS", kind: "local", keywords: ["pakistan", "oss", "maintainer"] },
  { name: "Climate Research", kind: "research", keywords: ["climate", "research", "citation"] },
];

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function matchReposForEcosystem(keywords: string[]): Promise<EcosystemRepo[]> {
  const repos: EcosystemRepo[] = [];
  for (const target of RADAR_TARGETS) {
    const fullName = `${target.owner}/${target.repo}`;
    const match = keywords.some(
      (k) =>
        fullName.toLowerCase().includes(k.toLowerCase()) ||
        target.repo.toLowerCase().includes(k.toLowerCase()) ||
        (k.includes("react") && target.repo.includes("next")),
    );
    if (!match) continue;
    const scanned = await scanFundingOpportunity(target.owner, target.repo).catch(() => null);
    repos.push({
      owner: target.owner,
      repo: target.repo,
      fullName,
      stars: scanned?.stars,
      fundingGapUsd: scanned?.health.fundingGapUsd,
      maintainerCount: scanned?.health.maintainerCount,
    });
  }
  return repos;
}

async function toRecord(
  row: Awaited<ReturnType<typeof prisma.resolveEcosystem.findFirst>> & object,
  missionCount: number,
): Promise<EcosystemRecord> {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    keywords: parseJson(row.keywordsJson, [] as string[]),
    repos: parseJson(row.reposJson, [] as EcosystemRepo[]),
    connectors: parseJson(row.connectorsJson, [] as string[]),
    missionCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function ensureSeedEcosystems(userId: string) {
  for (const seed of SEED_ECOSYSTEMS) {
    const existing = await prisma.resolveEcosystem.findUnique({
      where: { userId_name: { userId, name: seed.name } },
    });
    if (existing) continue;
    const repos = await matchReposForEcosystem(seed.keywords);
    const connectors = (await getConnectorLiveStatuses().catch(() => []))
      .filter((c) => c.health === "healthy")
      .map((c) => c.id);
    await prisma.resolveEcosystem.create({
      data: {
        userId,
        name: seed.name,
        kind: seed.kind,
        keywordsJson: JSON.stringify(seed.keywords),
        reposJson: JSON.stringify(repos),
        connectorsJson: JSON.stringify(connectors),
      },
    });
  }
}

export async function listEcosystems(userId: string): Promise<EcosystemRecord[]> {
  await ensureSeedEcosystems(userId);
  const rows = await prisma.resolveEcosystem.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
  const counts = await prisma.resolveMission.groupBy({
    by: ["ecosystemId"],
    where: { userId, ecosystemId: { not: null } },
    _count: true,
  });
  const countMap = new Map(counts.map((c) => [c.ecosystemId!, c._count]));
  return Promise.all(rows.map((r) => toRecord(r, countMap.get(r.id) ?? 0)));
}

export async function getEcosystem(userId: string, id: string): Promise<EcosystemRecord | null> {
  const row = await prisma.resolveEcosystem.findFirst({ where: { id, userId } });
  if (!row) return null;
  const missionCount = await prisma.resolveMission.count({ where: { ecosystemId: id, userId } });
  return toRecord(row, missionCount);
}

export async function createEcosystem(userId: string, name: string, kind = "organization") {
  const keywords = [name.toLowerCase()];
  const repos = await matchReposForEcosystem(keywords);
  const row = await prisma.resolveEcosystem.create({
    data: {
      userId,
      name,
      kind,
      keywordsJson: JSON.stringify(keywords),
      reposJson: JSON.stringify(repos),
      connectorsJson: JSON.stringify([]),
    },
  });
  await recordTimelineEvent({
    userId,
    ecosystemId: row.id,
    eventType: "ecosystem_created",
    title: `${name} ecosystem attached`,
    detail: `${repos.length} repositories linked from live scans`,
    severity: "info",
  });
  return toRecord(row, 0);
}

export async function refreshEcosystemRepos(userId: string, ecosystemId: string) {
  const row = await prisma.resolveEcosystem.findFirst({ where: { id: ecosystemId, userId } });
  if (!row) throw new Error("Ecosystem not found");
  const keywords = parseJson<string[]>(row.keywordsJson, []);
  const repos = await matchReposForEcosystem(keywords);
  const connectors = (await getConnectorLiveStatuses().catch(() => []))
    .filter((c) => c.health === "healthy")
    .map((c) => c.id);
  await prisma.resolveEcosystem.update({
    where: { id: ecosystemId },
    data: {
      reposJson: JSON.stringify(repos),
      connectorsJson: JSON.stringify(connectors),
    },
  });
  for (const repo of repos) {
    if ((repo.fundingGapUsd ?? 0) > 10000) {
      await recordTimelineEvent({
        userId,
        ecosystemId,
        eventType: "funding_gap_observed",
        title: `Funding gap · ${repo.fullName}`,
        detail: `$${Math.round((repo.fundingGapUsd ?? 0) / 1000)}k unfunded maintenance demand`,
        severity: "watch",
        metadata: repo,
      });
    }
  }
  const missionCount = await prisma.resolveMission.count({ where: { ecosystemId, userId } });
  return toRecord({ ...row, reposJson: JSON.stringify(repos), connectorsJson: JSON.stringify(connectors) }, missionCount);
}

export async function attachRepoToEcosystem(
  userId: string,
  ecosystemId: string,
  owner: string,
  repo: string,
) {
  const row = await prisma.resolveEcosystem.findFirst({ where: { id: ecosystemId, userId } });
  if (!row) throw new Error("Ecosystem not found");
  const repos = parseJson<EcosystemRepo[]>(row.reposJson, []);
  const fullName = `${owner}/${repo}`;
  if (repos.some((r) => r.fullName === fullName)) return getEcosystem(userId, ecosystemId);

  const scanned = await scanFundingOpportunity(owner, repo);
  const entry: EcosystemRepo = {
    owner,
    repo,
    fullName,
    stars: scanned?.stars,
    fundingGapUsd: scanned?.health.fundingGapUsd,
    maintainerCount: scanned?.health.maintainerCount,
  };
  repos.unshift(entry);
  await prisma.resolveEcosystem.update({
    where: { id: ecosystemId },
    data: { reposJson: JSON.stringify(repos) },
  });
  await recordTimelineEvent({
    userId,
    ecosystemId,
    eventType: "repo_attached",
    title: `Attached ${fullName}`,
    detail: scanned?.headline ?? "Repository linked to ecosystem",
    severity: "info",
    metadata: entry,
  });
  return getEcosystem(userId, ecosystemId);
}
