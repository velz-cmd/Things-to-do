import { prisma } from "@/lib/db";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { listFundableOpportunities, listCommunitiesNeedingFirstFunder } from "@/lib/capital/funder-discovery";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import { EntityIds } from "@/lib/domain/entities";
import { entityIdToPath } from "@/lib/entity/paths";
import type { TrendingValueGap } from "@/lib/discover/types";

function repoPath(owner: string, repo: string) {
  return `/e/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

/** Ranked value gaps from live scans + ledger — every item ships with actions. */
export async function buildTrendingValueGaps(limit = 12): Promise<TrendingValueGap[]> {
  const skipGithub = process.env.CI === "true";

  const [ossOpportunities, fundable, seedCommunities, pendingRows] = await Promise.all([
    skipGithub ? Promise.resolve([]) : scanAllOpportunities().catch(() => []),
    listFundableOpportunities(16),
    listCommunitiesNeedingFirstFunder(),
    process.env.DATABASE_URL
      ? prisma.paymentAuthorization
          .findMany({
            where: { status: { in: ["authorized", "pending_funding"] } },
            orderBy: { amountUsd: "desc" },
            take: 24,
            select: {
              id: true,
              amountUsd: true,
              payeeKey: true,
              payeeKeyType: true,
              connectorId: true,
              contextLabel: true,
              missionId: true,
            },
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const gaps: TrendingValueGap[] = [];

  for (const o of ossOpportunities.slice(0, 8)) {
    const path = repoPath(o.owner, o.repo);
    const priorityBoost = o.priority === "critical" ? 3 : o.priority === "high" ? 2 : 1;
    gaps.push({
      id: `oss-${o.fullName}`,
      domain: "oss",
      headline: `${o.fullName} — ${o.headline}`,
      why: `Maintainers shipping ${o.highImpactPrs} high-impact PRs with ~$${o.health.fundingGapUsd.toFixed(0)} funding gap`,
      whoBenefits: `${o.unfundedMaintainers} maintainers · ${o.stars.toLocaleString()} star ecosystem`,
      proofSource: `GitHub scan · health grade ${o.health.grade}`,
      amountNeededUsd: o.health.fundingGapUsd,
      moneyCanMoveUsd: o.health.fundingGapUsd,
      peopleImpacted: o.unfundedMaintainers,
      trendScore: o.health.fundingGapUsd * priorityBoost + o.stars * 0.01,
      entityPath: path,
      communitySlug: "react",
      templateId: "docs-bounty",
      actions: [
        { id: "open", label: "Open", kind: "open", entityPath: path },
        { id: "fund", label: "Fund gap", kind: "fund", href: "#opportunities" },
        {
          id: "bounty",
          label: "Docs bounty",
          kind: "create_program",
          communitySlug: "react",
          templateId: "docs-bounty",
        },
        {
          id: "sensor",
          label: "GitHub sensor",
          kind: "connect_sensor",
          communitySlug: "react",
          href: "/communities/react",
        },
        { id: "analyze", label: "Maintainer graph", kind: "analyze", entityPath: path },
      ],
    });
  }

  for (const o of fundable) {
    gaps.push({
      id: `program-${o.programId}`,
      domain: o.templateId === "quadratic-funding" ? "dao" : "community",
      headline: `${o.communityName} — ${o.programName}`,
      why: o.whyFund,
      whoBenefits: o.whoBenefits,
      proofSource: `Program ledger · ${o.signalCount} signals · ${o.contributorCount} contributors`,
      amountNeededUsd: o.fundingGapUsd,
      moneyCanMoveUsd: o.impactValueUsd,
      peopleImpacted: o.contributorCount,
      trendScore: o.score * 100 + o.fundingGapUsd,
      communitySlug: o.communitySlug,
      programId: o.programId,
      templateId: o.templateId,
      actions: [
        {
          id: "fund",
          label: o.templateId === "quadratic-funding" ? "Fund pool" : "Fulfill",
          kind: "fund",
          programId: o.programId,
        },
        {
          id: "open",
          label: "Open community",
          kind: "open",
          href: `/communities/${o.communitySlug}`,
        },
        {
          id: "sponsor",
          label: "Sponsor",
          kind: "sponsor",
          programId: o.programId,
        },
      ],
    });
  }

  for (const c of seedCommunities) {
    const domain =
      c.kind === "music" ? "music"
      : c.kind === "research" ? "research"
      : c.kind === "oss" ? "oss"
      : "community";
    gaps.push({
      id: `seed-${c.slug}`,
      domain,
      headline: `${c.name} — no active program yet`,
      why: c.doctrine,
      whoBenefits: `Operators and creators in ${c.upstream}`,
      proofSource: `Community catalog · featured attach point`,
      amountNeededUsd: 0,
      moneyCanMoveUsd: 0,
      peopleImpacted: 0,
      trendScore: c.featured ? 50 : 20,
      communitySlug: c.slug,
      actions: [
        { id: "install", label: "Install", kind: "install", communitySlug: c.slug },
        {
          id: "program",
          label: "Create program",
          kind: "create_program",
          communitySlug: c.slug,
        },
        {
          id: "sensor",
          label: "Connect sensor",
          kind: "connect_sensor",
          href: `/communities/${c.slug}`,
          communitySlug: c.slug,
        },
      ],
    });
  }

  const musicCommunities = COMMUNITY_CATALOG.filter((c) => c.kind === "music");
  for (const c of musicCommunities) {
    gaps.push({
      id: `music-${c.slug}`,
      domain: "music",
      headline: `${c.name} — artists with claimable plays`,
      why: "User-centric royalties when Navidrome or ListenBrainz sensors recognize plays",
      whoBenefits: "Artists, composers, session musicians",
      proofSource: `${c.upstream} · MusicBrainz attribution`,
      amountNeededUsd: 0,
      moneyCanMoveUsd: 0,
      peopleImpacted: 0,
      trendScore: 35,
      communitySlug: c.slug,
      templateId: "user-centric-royalties",
      actions: [
        { id: "install", label: "Install", kind: "install", communitySlug: c.slug },
        {
          id: "royalty",
          label: "Royalty pool",
          kind: "create_program",
          communitySlug: c.slug,
          templateId: "user-centric-royalties",
        },
        {
          id: "claim",
          label: "Claim artist",
          kind: "claim",
          href: "/claim",
        },
        {
          id: "connect",
          label: "MusicBrainz",
          kind: "connect_sensor",
          href: "/profile",
        },
      ],
    });
  }

  for (const r of pendingRows.slice(0, 6)) {
    const entityPath = entityIdToPath(
      r.payeeKeyType === "github_username"
        ? EntityIds.personGitHub(r.payeeKey)
        : r.payeeKeyType === "listen_artist"
          ? `creator:${r.payeeKey.toLowerCase()}`
          : `payee:${r.payeeKeyType}:${r.payeeKey}`,
    );
    gaps.push({
      id: `pending-${r.id}`,
      domain: r.connectorId === "github" ? "oss" : r.connectorId.includes("music") ? "music" : "community",
      headline: `${r.contextLabel ?? r.payeeKey} — payment pending funding`,
      why: "Authorization recorded at event time — capital has not cleared yet",
      whoBenefits: r.payeeKey,
      proofSource: `${r.connectorId} sensor · authorization ${r.id.slice(0, 8)}`,
      amountNeededUsd: r.amountUsd,
      moneyCanMoveUsd: r.amountUsd,
      peopleImpacted: 1,
      trendScore: r.amountUsd * 10 + 100,
      entityPath: entityPath ?? undefined,
      actions: [
        { id: "fund", label: "Fund", kind: "fund", href: "#opportunities", amountUsd: r.amountUsd },
        ...(entityPath
          ? [{ id: "open", label: "Open", kind: "open" as const, entityPath }]
          : []),
        { id: "share", label: "Share receipt", kind: "share", href: `/ledger/${r.id}` },
      ],
    });
  }

  return gaps
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, limit);
}
