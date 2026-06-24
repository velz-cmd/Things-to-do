import { prisma } from "@/lib/db";
import type { DistributionPlatform } from "@/lib/gateway/types";

export interface PayeeResolution {
  wallet: string | null;
  payeeName: string | null;
  attribution: string;
  confidence: number;
}

export async function resolvePayee(input: {
  platform: DistributionPlatform;
  platformId?: string;
  payload: Record<string, unknown>;
}): Promise<PayeeResolution> {
  const github = String(input.payload.githubUsername ?? input.payload.github ?? "");
  const exifArtist = String(input.payload.exifArtist ?? input.payload.artist ?? "");
  const mbid = String(input.payload.musicbrainzId ?? input.payload.mbid ?? "");
  const actor = String(input.payload.activitypubActor ?? input.payload.attributedTo ?? "");

  if (github) {
    const row = await prisma.contributorRegistry.findFirst({
      where: { githubUsername: github },
    });
    if (row) {
      return {
        wallet: row.walletAddress,
        payeeName: row.creatorName,
        attribution: `github:${github}`,
        confidence: row.verified ? 98 : 85,
      };
    }
  }

  if (exifArtist) {
    const row = await prisma.contributorRegistry.findFirst({
      where: { exifArtist: { equals: exifArtist, mode: "insensitive" } },
    });
    if (row) {
      return {
        wallet: row.walletAddress,
        payeeName: row.creatorName ?? exifArtist,
        attribution: `exif:${exifArtist}`,
        confidence: row.verified ? 97 : 84,
      };
    }
  }

  if (mbid) {
    const row = await prisma.contributorRegistry.findFirst({
      where: { musicbrainzId: mbid },
    });
    if (row) {
      return {
        wallet: row.walletAddress,
        payeeName: row.creatorName,
        attribution: `mbid:${mbid}`,
        confidence: row.verified ? 96 : 83,
      };
    }
  }

  if (actor) {
    const row = await prisma.contributorRegistry.findFirst({
      where: { activitypubActor: actor },
    });
    if (row) {
      return {
        wallet: row.walletAddress,
        payeeName: row.creatorName,
        attribution: `activitypub:${actor}`,
        confidence: row.verified ? 95 : 82,
      };
    }
  }

  if (input.platformId) {
    const row = await prisma.contributorRegistry.findFirst({
      where: { platform: input.platform, platformId: input.platformId },
    });
    if (row) {
      return {
        wallet: row.walletAddress,
        payeeName: row.creatorName,
        attribution: `${input.platform}:${input.platformId}`,
        confidence: row.verified ? 94 : 80,
      };
    }
  }

  const payeeWallet = input.payload.payeeWallet ?? input.payload.wallet;
  if (typeof payeeWallet === "string" && payeeWallet.startsWith("0x")) {
    return {
      wallet: payeeWallet,
      payeeName: String(input.payload.payeeName ?? "Direct wallet"),
      attribution: "direct",
      confidence: 70,
    };
  }

  return {
    wallet: null,
    payeeName: null,
    attribution: "unresolved",
    confidence: 0,
  };
}
