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
import { syncUserJellyfinSensors, connectJellyfinForUser } from "@/lib/connectors/user-jellyfin-sync";
import { autoInstallCommunitiesForUser } from "@/lib/communities/auto-install";
import { invalidateConnectorCaches } from "@/lib/profile/invalidate-connector-cache";
import { appendOperationalEventInTransaction } from "@/lib/events/operational-event";
import { persistProfileConnection } from "@/lib/profile/persisted-connection";

const navidromeSchema = z.object({
  url: z.string().url().max(512),
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(256),
});

const jellyfinConnectSchema = z.object({
  url: z.string().url().max(512),
  username: z.string().min(1).max(120),
  password: z.string().min(1).max(256),
  accessToken: z.string().min(8).max(512).optional(),
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
  data: { url: string; username: string; accessToken?: string; password?: string },
  message: string,
) {
  const url = data.url.trim().replace(/\/$/, "");
  const username = data.username.trim();

  await persistProfileConnection({
    userId,
    provider: "jellyfin",
    displayLabel: username || new URL(url).hostname,
  });

  void autoInstallCommunitiesForUser(userId, {
    jellyfinUrl: url,
    jellyfinUsername: username,
    jellyfinAccessToken: data.accessToken ?? "connected",
  }).catch(() => undefined);

  void syncUserJellyfinSensors(userId).catch(() => undefined);

  await invalidateConnectorCaches(userId);

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
    return NextResponse.redirect(
      new URL(`/connect/github?returnTo=${encodeURIComponent(safeReturn)}`, req.url),
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
      new URL(`/connect/listenbrainz?returnTo=${encodeURIComponent(safeReturn)}`, req.url),
    );
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

    await persistProfileConnection({
      userId: ready.user.id,
      provider: "navidrome",
      displayLabel: parsed.data.username.trim(),
    });

    void autoInstallCommunitiesForUser(ready.user.id, {
      navidromeUrl: parsed.data.url,
      navidromeUsername: parsed.data.username,
      navidromePassword: parsed.data.password,
    }).catch(() => undefined);

    void syncUserMusicSensors(ready.user.id).catch(() => undefined);

    await invalidateConnectorCaches(ready.user.id);

    return NextResponse.json({ ok: true, message: check.message });
  }

  if (platform === "jellyfin") {
    const parsed = jellyfinConnectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid Jellyfin credentials" }, { status: 400 });
    }

    const result = await connectJellyfinForUser(ready.user.id, parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return finalizeJellyfinConnect(ready.user.id, parsed.data, result.message);
  }

  return NextResponse.json({ error: "Unsupported platform" }, { status: 400 });
}

async function invalidateAfterDisconnect(userId: string) {
  await invalidateConnectorCaches(userId);
}

export async function DELETE(
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

  const idempotencyKey = req.headers.get("idempotency-key") ?? `profile.disconnect_source:${ready.user.id}:${platform}:${ready.profile.updatedAt.toISOString()}`;
  const correlationId = req.headers.get("x-correlation-id") ?? idempotencyKey;
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.actionRun.findUnique({ where: { idempotencyKey } });
    if (existing?.state === "completed") return { actionRunId: existing.id, replayed: true };
    await tx.user.update({ where: { id: ready.user.id }, data: DISCONNECT_FIELDS[platform] });
    await tx.sourceConnection.updateMany({ where: { userId: ready.user.id, provider: platform }, data: { status: "disconnected" } });
    const run = await tx.actionRun.upsert({
      where: { idempotencyKey },
      create: { userId: ready.user.id, actionId: "profile.disconnect_source", aggregateType: "SourceConnection", aggregateId: platform, idempotencyKey, state: "completed", recommendationReason: "The user explicitly confirmed that this evidence source should be disconnected.", input: { provider: platform }, output: { status: "disconnected" }, completedAt: new Date() },
      update: {},
    });
    await appendOperationalEventInTransaction(tx, { eventType: "profile.source_disconnected", aggregateType: "SourceConnection", aggregateId: platform, userId: ready.user.id, correlationId, idempotencyKey: `${idempotencyKey}:event`, payload: { provider: platform } });
    return { actionRunId: run.id, replayed: false };
  });

  await invalidateAfterDisconnect(ready.user.id);

  return NextResponse.json({ ok: true, ...result });
}
