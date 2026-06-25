import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";
import { resolvePayee } from "@/lib/registry/resolvers";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform");
  const id = searchParams.get("id");
  const github = searchParams.get("github");
  const exifArtist = searchParams.get("exifArtist");

  if (github) {
    const row = await prisma.contributorRegistry.findFirst({
      where: { githubUsername: github },
    });
    if (!row) return NextResponse.json({ resolved: false });
    return NextResponse.json({
      resolved: true,
      wallet: row.walletAddress,
      name: row.creatorName,
    });
  }

  if (exifArtist) {
    const payee = await resolvePayee({
      platform: "immich",
      payload: { exifArtist },
    });
    return NextResponse.json({
      resolved: Boolean(payee.wallet),
      wallet: payee.wallet,
      name: payee.payeeName,
      confidence: payee.confidence,
    });
  }

  if (platform && id) {
    const payee = await resolvePayee({
      platform: platform as "navidrome",
      platformId: id,
      payload: {},
    });
    return NextResponse.json({
      resolved: Boolean(payee.wallet),
      wallet: payee.wallet,
      name: payee.payeeName,
      confidence: payee.confidence,
    });
  }

  const rows = await prisma.contributorRegistry.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ contributors: rows });
}

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const body = await req.json();
  const wallet = body.walletAddress?.startsWith("0x") ? body.walletAddress : null;

  const row = await prisma.contributorRegistry.create({
    data: {
      platform: body.platform ?? "generic",
      platformId: body.platformId ?? body.githubUsername ?? `custom-${Date.now()}`,
      creatorName: body.creatorName ?? null,
      walletAddress: wallet,
      githubUsername: body.githubUsername ?? null,
      musicbrainzId: body.musicbrainzId ?? null,
      exifArtist: body.exifArtist ?? null,
      activitypubActor: body.activitypubActor ?? null,
      verified: body.verified ?? false,
    },
  });

  return NextResponse.json({ contributor: row });
}
