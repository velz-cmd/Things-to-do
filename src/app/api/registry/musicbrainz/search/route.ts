import { NextResponse } from "next/server";
import { searchMusicBrainzArtists } from "@/lib/attribution/musicbrainz-search";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ artists: [] });
  }

  const artists = await searchMusicBrainzArtists(q, 10);
  const mbids = artists.map((a) => a.mbid);
  const linked =
    mbids.length ?
      await prisma.contributorRegistry.findMany({
        where: { musicbrainzId: { in: mbids } },
        select: {
          musicbrainzId: true,
          walletAddress: true,
          verified: true,
          creatorName: true,
        },
      })
    : [];

  const linkedByMbid = new Map(linked.map((r) => [r.musicbrainzId, r]));

  return NextResponse.json({
    artists: artists.map((a) => {
      const reg = linkedByMbid.get(a.mbid);
      return {
        ...a,
        linked: Boolean(reg?.walletAddress),
        walletAddress: reg?.walletAddress ?? null,
        verified: reg?.verified ?? false,
      };
    }),
  });
}
