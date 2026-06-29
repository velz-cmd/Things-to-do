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
import { syncUserJellyfinSensors, saveJellyfinConnection, connectJellyfinForUser } from "@/lib/connectors/user-jellyfin-sync";
import { autoInstallCommunitiesForUser } from "@/lib/communities/auto-install";

const navidromeSchema = z.object({
  url: z.string().url().max(512),
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(256),
});

const jellyfinPasswordSchema = navidromeSchema;

const jellyfinTokenSchema = z.object({
  url: z.string().url().max(512),
  username: z.string().min(1).max(120),
  accessToken: z.string().min(8).max(512),
});

const PLATFORMS = new Set<ConnectPlatform>([
  "github",
  "gmail",
  "listenbrainz",
  "navidrome",
  "jellyfin",
]);

function contentTypeIncludesJson(req: Request) {
  return (req.headers.get("content-type") ?? "").includes("application/json");
}

async function finalizeJellyfinConnect(
  userId: string,
  data: { url: string; username: string; accessToken: string },
  message: string,
) {
  const url = data.url.trim().replace(/\/$/, "");
  const username = data.username.trim();

  void autoInstallCommunitiesForUser(userId, {
    jellyfinUrl: url,
    jellyfinUsername: username,
    jellyfinAccessToken: data.accessToken,
  }).catch(() => undefined);

  void syncUserJellyfinSensors(userId).catch(() => undefined);

  return NextResponse.json({ ok: true, message });
}

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
    return NextResponse.redirect(new URL("/connect/github", req.url));
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
    return NextResponse.redirect(new URL("/connect/listenbrainz", req.url));
  }

  if (platform === "jellyfin" && !contentTypeIncludesJson(req)) {
    const returnTo = new URL(req.url).searchParams.get("returnTo") ?? "/profile";
    const safeReturn = returnTo.startsWith("/") ? returnTo : "/profile";
    return NextResponse.redirect(
      new URL(`/connect/jellyfin?returnTo=${encodeURIComponent(safeReturn)}`, req.url),
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

    void autoInstallCommunitiesForUser(ready.user.id, {
      navidromeUrl: parsed.data.url,
      navidromeUsername: parsed.data.username,
      navidromePassword: parsed.data.password,
    }).catch(() => undefined);

    void syncUserMusicSensors(ready.user.id).catch(() => undefined);

    return NextResponse.json({ ok: true, message: check.message });
  }

  if (platform === "jellyfin") {
    const tokenParsed = jellyfinTokenSchema.safeParse(body);
    if (tokenParsed.success) {
      const result = await saveJellyfinConnection(ready.user.id, tokenParsed.data);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return finalizeJellyfinConnect(
        ready.user.id,
        {
          url: tokenParsed.data.url,
          username: tokenParsed.data.username,
          accessToken: result.accessToken,
        },
        result.message,
      );
    }

    const pwdParsed = jellyfinPasswordSchema.safeParse(body);
    if (!pwdParsed.success) {
      return NextResponse.json({ error: "Invalid Jellyfin credentials" }, { status: 400 });
    }

    const result = await connectJellyfinForUser(ready.user.id, pwdParsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return finalizeJellyfinConnect(
      ready.user.id,
      {
        url: pwdParsed.data.url,
        username: pwdParsed.data.username,
        accessToken: result.accessToken,
      },
      result.message,
    );
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
