import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { scanFundingOpportunity } from "@/lib/github/opportunities";
import { searchMusicBrainzArtists } from "@/lib/attribution/musicbrainz-search";
import { discoverWallet } from "@/lib/discover/discovery-service";
import { resolveCommunityForRepo } from "@/lib/discover/repo-community";
import { resolveFundTarget } from "@/lib/discover/fund-target";
import { isAlchemyConfigured } from "@/lib/wallet/alchemy";
import {
  artistEntityPath,
  isEvmWalletAddress,
  maintainerEntityPath,
  parseFundQueueFilter,
  parseMaintainerHandle,
  parseOwnerRepo,
  pickPrimaryAction,
  repoEntityPath,
  trimSearchActions,
  walletEntityPath,
} from "@/lib/discover/search-helpers";
import type { DiscoverAction, DiscoverSearchResult } from "@/lib/discover/types";

const GITHUB_INGEST_TIMEOUT_MS = 8_000;

export type DiscoverSearchPayload = {
  ok: true;
  results: DiscoverSearchResult[];
  topPrimaryAction: DiscoverAction | null;
  /** When set, client should filter fulfillment queue to this token */
  queueFilter: string | null;
};

function withActions(
  result: Omit<DiscoverSearchResult, "actions"> & { actions: DiscoverAction[] },
): DiscoverSearchResult {
  return { ...result, actions: trimSearchActions(result.actions) };
}

async function ingestRepoWithTimeout(owner: string, repo: string) {
  if (process.env.CI === "true") return null;
  try {
    return await Promise.race([
      scanFundingOpportunity(owner, repo),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), GITHUB_INGEST_TIMEOUT_MS)),
    ]);
  } catch {
    return null;
  }
}

async function buildRepoResult(
  owner: string,
  repo: string,
  opts?: { scannedAt?: string; fundingGapUsd?: number; headline?: string },
): Promise<DiscoverSearchResult> {
  const { communitySlug, templateId } = resolveCommunityForRepo(owner, repo);
  const path = repoEntityPath(owner, repo);
  const target = await resolveFundTarget({ communitySlug, templateId }).catch(() => null);
  const gap = opts?.fundingGapUsd;

  return withActions({
    id: `repo-${owner}/${repo}`,
    kind: "repository",
    label: `${owner}/${repo}`,
    subtitle:
      opts?.headline ??
      (gap != null ? `GitHub scan · ~$${gap.toFixed(0)} funding gap` : `Attach via ${communitySlug} community`),
    dataSource: "github",
    amountVerified: false,
    amountUsd: gap,
    entityPath: path,
    communitySlug,
    programId: target?.programId ?? undefined,
    templateId,
    actions: [
      { id: "open", label: "Open", kind: "open", entityPath: path },
      {
        id: "fund",
        label: target?.programId ? "Fund" : "Fund gap",
        kind: "fund",
        programId: target?.programId ?? undefined,
        communitySlug,
        templateId,
        amountUsd: gap != null ? Math.max(25, Math.min(gap, 100)) : undefined,
      },
      { id: "install", label: "Install", kind: "install", communitySlug },
      {
        id: "sensor",
        label: "GitHub sensor",
        kind: "connect_sensor",
        communitySlug,
        href: `/communities/${communitySlug}`,
      },
    ],
  });
}

async function searchMusicArtists(q: string): Promise<DiscoverSearchResult[]> {
  if (q.length < 2 || q.includes("/") || q.startsWith("@") || isEvmWalletAddress(q)) {
    return [];
  }
  const artists = await searchMusicBrainzArtists(q, 5);
  return artists.map((a) => {
    const path = artistEntityPath(a.mbid);
    return withActions({
      id: `artist-${a.mbid}`,
      kind: "entity",
      label: a.name,
      subtitle: [a.type, a.disambiguation].filter(Boolean).join(" · ") || "MusicBrainz artist",
      dataSource: "musicbrainz",
      amountVerified: false,
      entityPath: path,
      communitySlug: "navidrome",
      templateId: "user-centric-royalties",
      actions: [
        { id: "open", label: "Open", kind: "open", entityPath: path },
        { id: "claim", label: "Claim", kind: "claim", href: "/claim" },
        {
          id: "connect",
          label: "Connect MusicBrainz",
          kind: "connect_sensor",
          href: "/profile",
        },
        {
          id: "install",
          label: "Install Navidrome",
          kind: "install",
          communitySlug: "navidrome",
        },
      ],
    });
  });
}

async function searchWalletAddress(address: string): Promise<DiscoverSearchResult | null> {
  const normalized = address.trim();
  const path = walletEntityPath(normalized);
  const short = `${normalized.slice(0, 6)}…${normalized.slice(-4)}`;

  if (isAlchemyConfigured()) {
    const scan = await discoverWallet(normalized);
    const balanceItem = scan.items.find((i) => i.id === "wallet-usdc-balance");
    const balance = balanceItem?.amountUsd ?? 0;
    if (scan.source === "scan" && balanceItem) {
      return withActions({
        id: `wallet-${normalized.toLowerCase()}`,
        kind: "entity",
        label: balanceItem.label,
        subtitle: scan.message ?? "Arc USDC balance via Alchemy",
        dataSource: "arc",
        amountVerified: true,
        amountUsd: balance,
        entityPath: path,
        actions: [
          { id: "open", label: "Open wallet", kind: "open", entityPath: path },
          { id: "capital", label: "Capital", kind: "open", href: "/capital" },
        ],
      });
    }
  }

  return withActions({
    id: `wallet-${normalized.toLowerCase()}`,
    kind: "entity",
    label: short,
    subtitle: isAlchemyConfigured()
      ? "Wallet entity — Arc scan returned no balance"
      : "Wallet entity — configure ALCHEMY_API_KEY for live Arc balance",
    dataSource: "local_seed",
    amountVerified: false,
    entityPath: path,
    actions: [
      { id: "open", label: "Open entity", kind: "open", entityPath: path },
      { id: "capital", label: "View in Capital", kind: "open", href: "/capital" },
    ],
  });
}

function buildMaintainerResult(username: string): DiscoverSearchResult {
  const path = maintainerEntityPath(username);
  return withActions({
    id: `maintainer-${username.toLowerCase()}`,
    kind: "entity",
    label: `@${username}`,
    subtitle: "GitHub maintainer entity",
    dataSource: "github",
    amountVerified: false,
    entityPath: path,
    communitySlug: "react",
    actions: [
      { id: "open", label: "Open", kind: "open", entityPath: path },
      { id: "install", label: "Install React", kind: "install", communitySlug: "react" },
      {
        id: "sensor",
        label: "GitHub sensor",
        kind: "connect_sensor",
        communitySlug: "react",
        href: "/communities/react",
      },
      { id: "claim", label: "Claim", kind: "claim", href: "/claim" },
    ],
  });
}

const DOMAIN_HINTS: Record<string, { label: string; href: string }> = {
  music: { label: "Music radar", href: "#radar-music" },
  artist: { label: "Creator radar", href: "#radar-music" },
  oss: { label: "OSS radar", href: "#radar-oss" },
  github: { label: "OSS radar", href: "#radar-oss" },
  research: { label: "Research radar", href: "#radar-dao" },
  dao: { label: "DAO radar", href: "#radar-dao" },
  claim: { label: "Claim earnings", href: "/claim" },
  fund: { label: "Fulfillment queue", href: "#opportunities" },
};

export async function searchDiscover(rawQuery: string): Promise<DiscoverSearchPayload> {
  const q = rawQuery.trim().toLowerCase();
  if (!q) {
    return { ok: true, results: [], topPrimaryAction: null, queueFilter: null };
  }

  const queueFilter = parseFundQueueFilter(q);
  const results: DiscoverSearchResult[] = [];
  const seen = new Set<string>();

  function push(result: DiscoverSearchResult) {
    if (seen.has(result.id)) return;
    seen.add(result.id);
    results.push(result);
  }

  const repo = parseOwnerRepo(rawQuery.trim());
  if (repo) {
    const opp = await ingestRepoWithTimeout(repo.owner, repo.repo);
    if (opp) {
      push(
        await buildRepoResult(repo.owner, repo.repo, {
          scannedAt: new Date().toISOString(),
          fundingGapUsd: opp.health.fundingGapUsd,
          headline: opp.headline,
        }),
      );
    } else {
      push(await buildRepoResult(repo.owner, repo.repo));
    }
  }

  const maintainer = parseMaintainerHandle(rawQuery.trim());
  if (maintainer) {
    push(buildMaintainerResult(maintainer));
  }

  if (isEvmWalletAddress(rawQuery.trim())) {
    const wallet = await searchWalletAddress(rawQuery.trim());
    if (wallet) push(wallet);
  }

  const [artists, fundable] = await Promise.all([
    searchMusicArtists(rawQuery.trim()),
    listFundableOpportunities(24),
  ]);

  for (const a of artists) push(a);

  for (const c of COMMUNITY_CATALOG) {
    if (
      c.name.toLowerCase().includes(q) ||
      c.slug.includes(q) ||
      c.keywords.some((k) => k.includes(q)) ||
      c.tagline.toLowerCase().includes(q) ||
      (queueFilter && c.slug.includes(queueFilter))
    ) {
      push(
        withActions({
          id: `community-${c.slug}`,
          kind: "community",
          label: c.name,
          subtitle: c.tagline,
          dataSource: "community_catalog",
          amountVerified: false,
          communitySlug: c.slug,
          actions: [
            { id: "install", label: "Install", kind: "install", communitySlug: c.slug },
            { id: "open", label: "Open", kind: "open", href: `/communities/${c.slug}` },
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
            },
          ],
        }),
      );
    }
  }

  for (const o of fundable.filter((p) => p.fundingGapUsd > 0)) {
    const matchesQuery =
      o.programName.toLowerCase().includes(q) ||
      o.communityName.toLowerCase().includes(q) ||
      o.communitySlug.includes(q) ||
      (queueFilter &&
        (o.communitySlug.includes(queueFilter) ||
          o.communityName.toLowerCase().includes(queueFilter)));

    if (matchesQuery) {
      push(
        withActions({
          id: `program-${o.programId}`,
          kind: "program",
          label: o.programName,
          subtitle: `${o.communityName} · $${o.fundingGapUsd.toFixed(0)} gap`,
          dataSource: "supabase_ledger",
          amountVerified: true,
          amountUsd: o.fundingGapUsd,
          communitySlug: o.communitySlug,
          programId: o.programId,
          templateId: o.templateId,
          actions: [
            {
              id: "fund",
              label: "Fund",
              kind: "fund",
              programId: o.programId,
              amountUsd: Math.max(25, Math.min(o.fundingGapUsd, 250)),
            },
            { id: "open", label: "Open community", kind: "open", href: `/communities/${o.communitySlug}` },
            {
              id: "sponsor",
              label: "Sponsor",
              kind: "sponsor",
              programId: o.programId,
            },
          ],
        }),
      );
    }
  }

  for (const [key, hint] of Object.entries(DOMAIN_HINTS)) {
    if (q === key || q.includes(key)) {
      push(
        withActions({
          id: `domain-${key}`,
          kind: "domain",
          label: hint.label,
          subtitle: `Jump to ${key} in Discover`,
          dataSource: "local_seed",
          amountVerified: false,
          actions: [{ id: "jump", label: "Go", kind: "open", href: hint.href }],
        }),
      );
    }
  }

  const ranked = results.sort((a, b) => scoreResult(a, q, queueFilter) - scoreResult(b, q, queueFilter));
  const top = ranked[0] ?? null;

  let topPrimaryAction: DiscoverAction | null = null;
  if (queueFilter && ranked.some((r) => r.kind === "program")) {
    const program = ranked.find((r) => r.kind === "program");
    topPrimaryAction = program ? pickPrimaryAction(program) : { id: "queue", label: "Fulfill", kind: "open", href: "#opportunities" };
  } else if (top) {
    topPrimaryAction = pickPrimaryAction(top);
  }

  return {
    ok: true,
    results: ranked.slice(0, 12),
    topPrimaryAction,
    queueFilter,
  };
}

function scoreResult(r: DiscoverSearchResult, q: string, queueFilter: string | null): number {
  let score = 0;
  const label = r.label.toLowerCase();
  if (label === q) score += 100;
  if (r.kind === "repository" && label.includes("/")) score += 80;
  if (r.kind === "entity" && r.entityPath?.includes("/maintainer/")) score += 70;
  if (r.kind === "program" && queueFilter && r.communitySlug?.includes(queueFilter)) score += 90;
  if (r.dataSource === "supabase_ledger") score += 25;
  if (r.dataSource === "github" && r.amountUsd != null) score += 8;
  if (r.dataSource === "github" && r.amountVerified) score += 5;
  if (r.dataSource === "musicbrainz") score += 10;
  return score;
}
