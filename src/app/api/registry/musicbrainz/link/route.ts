import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { lookupMusicBrainzArtist } from "@/lib/attribution/musicbrainz-search";
import { linkWalletToMusicBrainz } from "@/lib/identity/contributors";

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const body = await req.json().catch(() => ({}));
  const mbid = String(body.mbid ?? "").trim().toLowerCase();
  const artistName = String(body.artistName ?? "").trim();
  const walletAddress = String(body.walletAddress ?? "").trim();

  if (!mbid) {
    return NextResponse.json({ error: "mbid required" }, { status: 400 });
  }

  const artist = artistName ?
    { mbid, name: artistName }
  : await lookupMusicBrainzArtist(mbid);
  if (!artist) {
    return NextResponse.json({ error: "Artist not found on MusicBrainz" }, { status: 404 });
  }

  const payoutWallet =
    walletAddress ||
    ready.profile.walletAddress ||
    ready.profile.scanWalletAddress ||
    null;

  if (!payoutWallet?.match(/^0x[a-fA-F0-9]{40}$/)) {
    return NextResponse.json(
      { error: "Connect a payout account in Settings first — email sign-in works too" },
      { status: 400 },
    );
  }

  try {
    const contributor = await linkWalletToMusicBrainz({
      mbid,
      artistName: artist.name,
      walletAddress: payoutWallet,
      email: ready.profile.email,
      userId: ready.profile.id,
    });

    return NextResponse.json({
      ok: true,
      contributor: {
        id: contributor.id,
        musicbrainzId: contributor.musicbrainzId,
        creatorName: contributor.creatorName,
        walletAddress: contributor.walletAddress,
        verified: contributor.verified,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Link failed" },
      { status: 400 },
    );
  }
}

export async function GET(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const { searchParams } = new URL(req.url);
  const mbid = searchParams.get("mbid")?.trim().toLowerCase();
  if (!mbid) {
    return NextResponse.json({ error: "mbid required" }, { status: 400 });
  }

  const { getContributorByMusicBrainz } = await import("@/lib/identity/contributors");
  const row = await getContributorByMusicBrainz(mbid);
  return NextResponse.json({
    linked: Boolean(row?.walletAddress),
    contributor: row,
  });
}
