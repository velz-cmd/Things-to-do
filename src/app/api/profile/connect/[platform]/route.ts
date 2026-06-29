import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";
import {
  DISCONNECT_FIELDS,
  validateNavidromeCredentials,
  type ConnectPlatform,
} from "@/lib/profile/user-connections";
import { syncUserMusicSensors } from "@/lib/connectors/user-music-sync";

const navidromeSchema = z.object({
  url: z.string().url().max(512),
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(256),
});

const PLATFORMS = new Set<ConnectPlatform>(["github", "gmail", "listenbrainz", "navidrome"]);

export async function POST(
  req: Request,
  ctx: { params: Promise<{ platform: string }> },
) {
  const { platform: raw } = await ctx.params;
  const platform = raw as ConnectPlatform;
  if (!PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  }

  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  if (platform === "github") {
    const returnTo = new URL(req.url).searchParams.get("returnTo") ?? "/profile";
    const safeReturn = returnTo.startsWith("/") ? returnTo : "/profile";
    return NextResponse.redirect(
      new URL(
        `/api/connectors/github/authorize?returnTo=${encodeURIComponent(safeReturn)}`,
        req.url,
      ),
    );
  }

  if (platform === "gmail") {
    const returnTo = new URL(req.url).searchParams.get("returnTo") ?? "/profile";
    const safeReturn = returnTo.startsWith("/") ? returnTo : "/profile";
    return NextResponse.redirect(
      new URL(
        `/api/connectors/gmail/authorize?returnTo=${encodeURIComponent(safeReturn)}`,
        req.url,
      ),
    );
  }

  if (platform === "listenbrainz") {
    const returnTo = new URL(req.url).searchParams.get("returnTo") ?? "/profile";
    const safeReturn = returnTo.startsWith("/") ? returnTo : "/profile";
    return NextResponse.redirect(
      new URL(
        `/api/connectors/listenbrainz/authorize?returnTo=${encodeURIComponent(safeReturn)}`,
        req.url,
      ),
    );
  }

  const body = await req.json().catch(() => ({}));

  if (platform === "navidrome") {
    const parsed = navidromeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid Navidrome credentials" }, { status: 400 });
    }

    const check = await validateNavidromeCredentials(
      parsed.data.url,
      parsed.data.username,
      parsed.data.password,
    );
    if (!check.ok) {
      return NextResponse.json({ error: check.message }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: ready.user.id },
      data: {
        navidromeUrl: parsed.data.url.trim().replace(/\/$/, ""),
        navidromeUsername: parsed.data.username.trim(),
        navidromePassword: parsed.data.password,
      },
    });

    void syncUserMusicSensors(ready.user.id).catch(() => undefined);

    return NextResponse.json({ ok: true, message: check.message });
  }

  return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ platform: string }> },
) {
  const { platform: raw } = await ctx.params;
  const platform = raw as ConnectPlatform;
  if (!PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  }

  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  await prisma.user.update({
    where: { id: ready.user.id },
    data: DISCONNECT_FIELDS[platform],
  });

  return NextResponse.json({ ok: true });
}
