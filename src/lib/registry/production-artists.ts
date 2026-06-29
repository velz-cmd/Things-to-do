import { prisma } from "@/lib/db";

export type ProductionArtistRow = {
  creatorName: string;
  exifArtist?: string;
  musicbrainzId?: string;
  listenArtist?: string;
  walletAddress: string;
  platform?: string;
  platformId?: string;
};

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

/** Default artists for hackathon demo — override via PRODUCTION_ARTIST_REGISTRY JSON env. */
export const DEFAULT_PRODUCTION_ARTISTS: ProductionArtistRow[] = [
  {
    creatorName: "Radiohead",
    exifArtist: "Radiohead",
    musicbrainzId: "a74b1b7f-71a5-4011-9441-d930b8163b73",
    platform: "listenbrainz",
    platformId: "radiohead",
    walletAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  },
  {
    creatorName: "Björk",
    exifArtist: "Björk",
    musicbrainzId: "6f0eaa41-f9b2-49e2-bf82-4de4f0aec5d0",
    platform: "listenbrainz",
    platformId: "bjork",
    walletAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
  },
];

function parseRegistryEnv(): ProductionArtistRow[] {
  const raw = process.env.PRODUCTION_ARTIST_REGISTRY?.trim();
  if (!raw) return DEFAULT_PRODUCTION_ARTISTS;

  try {
    const parsed = JSON.parse(raw) as ProductionArtistRow[];
    if (!Array.isArray(parsed)) return DEFAULT_PRODUCTION_ARTISTS;
    return parsed.filter(
      (row) =>
        row.creatorName?.trim() &&
        row.walletAddress?.match(WALLET_RE),
    );
  } catch {
    return DEFAULT_PRODUCTION_ARTISTS;
  }
}

export function listProductionArtists(): ProductionArtistRow[] {
  return parseRegistryEnv();
}

export async function countProductionRegistryArtists(): Promise<number> {
  const artists = listProductionArtists();
  if (!artists.length) return 0;

  const names = artists.map((a) => a.creatorName);
  return prisma.contributorRegistry.count({
    where: {
      OR: [
        { creatorName: { in: names } },
        { exifArtist: { in: names } },
        { musicbrainzId: { in: artists.map((a) => a.musicbrainzId).filter(Boolean) as string[] } },
      ],
      walletAddress: { not: null },
    },
  });
}

/** Seed real artist → wallet rows for deploy-time payee resolution (not demo fake MBIDs). */
export async function seedProductionArtistRegistry(): Promise<{
  seeded: number;
  skipped: number;
  artists: string[];
}> {
  const artists = listProductionArtists();
  let seeded = 0;
  let skipped = 0;
  const names: string[] = [];

  for (const row of artists) {
    if (!row.walletAddress.match(WALLET_RE)) {
      skipped++;
      continue;
    }

    const platform = row.platform ?? "listenbrainz";
    const platformId =
      row.platformId ?? row.listenArtist ?? row.exifArtist ?? row.creatorName;

    const existing = await prisma.contributorRegistry.findFirst({
      where: {
        OR: [
          { platform, platformId },
          row.musicbrainzId ? { musicbrainzId: row.musicbrainzId } : undefined,
          row.exifArtist ? { exifArtist: row.exifArtist } : undefined,
        ].filter(Boolean) as object[],
      },
    });

    if (existing?.walletAddress?.match(WALLET_RE)) {
      skipped++;
      names.push(row.creatorName);
      continue;
    }

    if (existing) {
      await prisma.contributorRegistry.update({
        where: { id: existing.id },
        data: {
          walletAddress: row.walletAddress,
          creatorName: row.creatorName,
          exifArtist: row.exifArtist ?? row.creatorName,
          musicbrainzId: row.musicbrainzId ?? existing.musicbrainzId,
          verified: true,
          status: "verified",
          lastSeenAt: new Date(),
        },
      });
    } else {
      await prisma.contributorRegistry.create({
        data: {
          platform,
          platformId,
          creatorName: row.creatorName,
          exifArtist: row.exifArtist ?? row.creatorName,
          musicbrainzId: row.musicbrainzId ?? null,
          walletAddress: row.walletAddress,
          verified: true,
          status: "verified",
          lastSeenAt: new Date(),
        },
      });
    }

    seeded++;
    names.push(row.creatorName);
  }

  return { seeded, skipped, artists: names };
}
