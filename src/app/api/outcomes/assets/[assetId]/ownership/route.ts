import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getOutcomeAdapter } from "@/lib/outcomes/adapters/registry";

type Context = { params: Promise<{ assetId: string }> };

function asJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

async function ownedAsset(assetId: string, userId: string) {
  return prisma.creatorAsset.findFirst({ where: { id: assetId, ownerUserId: userId } });
}

export async function GET(_request: Request, context: Context) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { assetId } = await context.params;
  let asset = await ownedAsset(assetId, ready.user.id);
  if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  if (!asset.ownershipChallenge && asset.ownershipState !== "verified") {
    asset = await prisma.creatorAsset.update({ where: { id: asset.id }, data: { ownershipChallenge: `resolve-verify-${randomBytes(12).toString("hex")}`, ownershipState: "verification_pending" } });
  }
  return NextResponse.json({ assetId: asset.id, state: asset.ownershipState, challenge: asset.ownershipChallenge, verifiedAt: asset.ownershipVerifiedAt?.toISOString() ?? null });
}

export async function POST(request: Request, context: Context) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const { assetId } = await context.params;
  let asset = await ownedAsset(assetId, ready.user.id);
  if (!asset) return NextResponse.json({ error: "Asset not found." }, { status: 404 });
  if (asset.ownershipState === "verified") return NextResponse.json({ ok: true, state: "verified", replayed: true });
  if (!asset.ownershipChallenge) {
    asset = await prisma.creatorAsset.update({ where: { id: asset.id }, data: { ownershipChallenge: `resolve-verify-${randomBytes(12).toString("hex")}`, ownershipState: "verification_pending" } });
  }
  const adapter = getOutcomeAdapter(asset.sourceAdapterId);
  if (!adapter || adapter.status !== "live") return NextResponse.json({ error: "The ownership provider is not available." }, { status: 409 });
  const proof = await adapter.verifyOwnership({ url: asset.canonicalUrl, challenge: asset.ownershipChallenge! });
  if (!proof.verified) return NextResponse.json({ error: proof.blocker ?? "Ownership proof was not found.", challenge: asset.ownershipChallenge }, { status: 422 });
  const verifiedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const verified = await tx.creatorAsset.update({ where: { id: asset.id }, data: { ownershipState: "verified", ownershipProof: asJson(proof.proof ?? {}), ownershipVerifiedAt: verifiedAt } });
    await tx.actionRun.create({ data: { userId: ready.user.id, actionId: "asset.verify_ownership", aggregateType: "CreatorAsset", aggregateId: asset.id, idempotencyKey: `asset.verify_ownership:${asset.id}:${asset.ownershipChallenge}`, state: "completed", recommendationReason: "Provider metadata contains the private verification challenge issued for this signed-in creator.", input: { assetId: asset.id, provider: adapter.id }, output: { state: "verified", verifiedAt: verifiedAt.toISOString() }, completedAt: verifiedAt } });
    return verified;
  });
  return NextResponse.json({ ok: true, assetId: updated.id, state: updated.ownershipState, verifiedAt: updated.ownershipVerifiedAt?.toISOString() });
}
