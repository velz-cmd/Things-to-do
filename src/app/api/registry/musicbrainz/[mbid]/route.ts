import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** MusicBrainz Payee Registry — public lookup for scrobble sidecars and Navidrome operators. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const { mbid } = await params;
  if (!mbid || mbid.length < 4) {
    return NextResponse.json({ error: "Invalid MusicBrainz ID" }, { status: 400 });
  }

  const row = await prisma.contributorRegistry.findFirst({
    where: { musicbrainzId: mbid },
  });

  if (!row) {
    return NextResponse.json({
      mbid,
      registered: false,
      message: "Artist not in payee registry — invite them to claim at /music",
    });
  }

  return NextResponse.json({
    mbid,
    registered: true,
    artistName: row.creatorName,
    wallet: row.walletAddress,
    verified: row.verified,
    platform: row.platform,
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ mbid: string }> }
) {
  const { mbid } = await params;
  const body = await req.json();

  if (!body.walletAddress?.startsWith("0x")) {
    return NextResponse.json({ error: "Valid walletAddress required" }, { status: 400 });
  }

  const existing = await prisma.contributorRegistry.findFirst({
    where: { musicbrainzId: mbid },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This MusicBrainz ID is already registered", contributor: existing },
      { status: 409 }
    );
  }

  const row = await prisma.contributorRegistry.create({
    data: {
      platform: "musicbrainz",
      platformId: mbid,
      musicbrainzId: mbid,
      creatorName: body.artistName ?? body.creatorName ?? null,
      walletAddress: body.walletAddress,
      verified: false,
    },
  });

  return NextResponse.json({ ok: true, contributor: row }, { status: 201 });
}
