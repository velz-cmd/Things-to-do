import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getOutcomeAdapter } from "@/lib/outcomes/adapters/registry";
import { runIdempotent } from "@/lib/idempotency/service";

const schema = z.object({ type: z.enum(["video", "article", "repository", "research", "audio", "dataset", "community", "other"]), canonicalUrl: z.string().url(), title: z.string().min(2).max(180), description: z.string().max(2000).optional(), sourceAdapterId: z.string().min(2) });

export async function GET() {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const assets = await prisma.creatorAsset.findMany({ where: { ownerUserId: ready.user.id }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Provide a canonical asset URL, title, type, and supported adapter." }, { status: 400 });
  const adapter = getOutcomeAdapter(parsed.data.sourceAdapterId);
  if (!adapter || adapter.status !== "live") return NextResponse.json({ error: "That verification adapter is not live. Use GitHub or PeerTube for P0." }, { status: 409 });
  const validated = await adapter.validateSource({ url: parsed.data.canonicalUrl });
  if (!validated.valid) return NextResponse.json({ error: validated.blocker ?? "The source could not be validated." }, { status: 422 });
  const key = request.headers.get("idempotency-key") ?? `asset.register:${ready.user.id}:${parsed.data.canonicalUrl}`;
  const { data, replayed } = await runIdempotent({ key, scope: "asset.register", userId: ready.user.id, request: parsed.data, execute: async () => {
    const run = await prisma.actionRun.create({ data: { userId: ready.user.id, actionId: "asset.register", aggregateType: "CreatorAsset", idempotencyKey: key, state: "running", recommendationReason: "A canonical owned asset is required before a paid campaign can be approved.", input: parsed.data } });
    const challenge = `resolve-verify-${randomBytes(12).toString("hex")}`;
    const asset = await prisma.creatorAsset.upsert({ where: { ownerUserId_canonicalUrl: { ownerUserId: ready.user.id, canonicalUrl: parsed.data.canonicalUrl } }, update: { title: parsed.data.title, description: parsed.data.description, sourceAdapterId: adapter.id, externalId: validated.externalId }, create: { ownerUserId: ready.user.id, type: parsed.data.type, canonicalUrl: parsed.data.canonicalUrl, title: parsed.data.title, description: parsed.data.description, sourceAdapterId: adapter.id, externalId: validated.externalId, ownershipState: "verification_pending", ownershipChallenge: challenge } });
    await prisma.actionRun.update({ where: { id: run.id }, data: { aggregateId: asset.id, state: "completed", completedAt: new Date(), output: { assetId: asset.id, ownershipState: asset.ownershipState } } });
    return { assetId: asset.id, ownershipState: asset.ownershipState, ownershipChallenge: asset.ownershipChallenge, blocker: "Add the verification code to the asset description, then verify ownership before funding or publication." };
  } });
  return NextResponse.json({ ...data, replayed }, { status: 201 });
}
