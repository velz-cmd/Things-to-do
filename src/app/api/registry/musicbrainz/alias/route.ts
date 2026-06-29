import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import {
  linkScrobbleArtistAlias,
  listScrobbleAliasesForWallet,
} from "@/lib/identity/contributors";

export async function GET() {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wallet = ready.profile.scanWalletAddress ?? ready.profile.walletAddress;
  if (!wallet) {
    return NextResponse.json({ aliases: [] });
  }

  const rows = await listScrobbleAliasesForWallet(wallet);
  return NextResponse.json({
    aliases: rows
      .filter((r) => r.exifArtist)
      .map((r) => ({
        id: r.id,
        artistName: r.exifArtist,
        musicbrainzId: r.musicbrainzId,
        verified: r.verified,
      })),
  });
}

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const artistName = String(body.artistName ?? "").trim();
  const musicbrainzId = body.musicbrainzId ? String(body.musicbrainzId) : null;

  const wallet = ready.profile.scanWalletAddress ?? ready.profile.walletAddress;
  if (!wallet) {
    return NextResponse.json({ error: "Connect a payout wallet first" }, { status: 400 });
  }

  try {
    const row = await linkScrobbleArtistAlias({
      userId: ready.user.id,
      aliasName: artistName,
      walletAddress: wallet,
      musicbrainzId,
    });
    return NextResponse.json({
      ok: true,
      alias: { id: row.id, artistName: row.exifArtist, verified: row.verified },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not link artist name" },
      { status: 400 },
    );
  }
}
