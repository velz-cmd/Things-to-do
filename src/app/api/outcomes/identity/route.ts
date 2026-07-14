import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAddress } from "viem";
import type { Prisma } from "@prisma/client";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { getOutcomeAdapter } from "@/lib/outcomes/adapters/registry";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect_identity"), provider: z.enum(["github", "peertube"]), submissionId: z.string().min(1).optional() }),
  z.object({ action: z.literal("bind_payout"), identityId: z.string().min(1) }),
]);
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function GET() {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const [identities, wallets] = await Promise.all([
    prisma.identity.findMany({ where: { userId: ready.user.id, status: "verified" }, orderBy: { verifiedAt: "desc" } }),
    prisma.wallet.findMany({ where: { userId: ready.profile.id, status: "active" }, select: { id: true, network: true, address: true, custodyType: true } }),
  ]);
  const payouts = identities.length ? await prisma.payoutDestination.findMany({ where: { identityId: { in: identities.map((identity) => identity.id) }, status: "verified" } }) : [];
  return NextResponse.json({ identities, payouts, wallets });
}

export async function POST(request: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a supported identity or payout action." }, { status: 400 });
  if (parsed.data.action === "connect_identity") {
    const provider = parsed.data.provider;
    const source = await prisma.sourceConnection.findFirst({ where: { userId: ready.user.id, provider, status: "connected", externalAccountId: { not: null } }, orderBy: { updatedAt: "desc" } });
    let submission = provider === "peertube" && parsed.data.submissionId ? await prisma.workSubmission.findFirst({ where: { id: parsed.data.submissionId, userId: ready.user.id } }) : null;
    let providerProof: Record<string, unknown> | null = null;
    let externalIdentity = provider === "github" ? ready.profile.githubUsername ?? source?.externalAccountId : source?.externalAccountId;
    if (provider === "peertube" && !externalIdentity && submission) {
      if (!submission.identityChallenge) {
        submission = await prisma.workSubmission.update({ where: { id: submission.id }, data: { identityChallenge: `resolve-identity-${randomBytes(12).toString("hex")}` } });
        return NextResponse.json({ ok: true, state: "challenge_required", challenge: submission.identityChallenge, blocker: `Add ${submission.identityChallenge} to the submitted PeerTube video description, save it, then verify again.` }, { status: 202 });
      }
      const adapter = getOutcomeAdapter("peertube");
      const proof = adapter ? await adapter.verifyOwnership({ url: submission.workUrl, challenge: submission.identityChallenge }) : { verified: false, blocker: "PeerTube verification is unavailable." };
      if (!proof.verified) return NextResponse.json({ error: proof.blocker ?? "PeerTube identity proof was not found.", challenge: submission.identityChallenge }, { status: 422 });
      providerProof = proof.proof ?? {};
      externalIdentity = typeof providerProof.account === "string" && providerProof.account ? providerProof.account : typeof providerProof.channel === "string" && providerProof.channel ? providerProof.channel : `video:${submission.id}`;
    }
    if (!externalIdentity) return NextResponse.json({ error: `Connect ${provider === "github" ? "GitHub" : "PeerTube"} in Profile before verifying this identity.`, recoveryUrl: "/profile?section=connections" }, { status: 409 });
    const canonicalRef = `${provider}:${externalIdentity.toLowerCase()}`;
    const claimed = await prisma.identity.findUnique({ where: { canonicalRef }, select: { userId: true } });
    if (claimed?.userId && claimed.userId !== ready.user.id) return NextResponse.json({ error: "This provider identity is already verified by another RESOLVE account." }, { status: 409 });
    const now = new Date();
    const identity = await prisma.$transaction(async (tx) => {
      const row = await tx.identity.upsert({ where: { canonicalRef }, create: { userId: ready.user.id, canonicalRef, displayName: source?.displayLabel ?? externalIdentity, status: "verified", confidencePpm: 1_000_000, verifiedAt: now, metadata: json({ provider, sourceConnectionId: source?.id ?? null, verification: providerProof ? "provider_metadata_challenge" : source ? "connected_source" : "authenticated_github_profile", providerProof }) }, update: { userId: ready.user.id, status: "verified", confidencePpm: 1_000_000, verifiedAt: now } });
      const campaigns = await tx.outcomeCampaign.findMany({ where: { verificationAdapterId: provider }, select: { id: true } });
      await tx.campaignParticipant.updateMany({ where: { userId: ready.user.id, campaignId: { in: campaigns.map((campaign) => campaign.id) } }, data: { identityId: row.id } });
      if (submission && providerProof) await tx.workSubmission.update({ where: { id: submission.id }, data: { identityProof: json(providerProof), identityVerifiedAt: now } });
      await tx.actionRun.upsert({ where: { idempotencyKey: `identity.claim:${ready.user.id}:${canonicalRef}` }, create: { userId: ready.user.id, actionId: "identity.claim", aggregateType: "Identity", aggregateId: row.id, idempotencyKey: `identity.claim:${ready.user.id}:${canonicalRef}`, state: "completed", recommendationReason: "The identity is backed by an authenticated profile field or connected source account.", input: { provider }, output: { identityId: row.id, status: "verified" }, completedAt: now }, update: {} });
      return row;
    });
    return NextResponse.json({ ok: true, identityId: identity.id, status: identity.status, nextAction: "identity.set_payout_destination" });
  }

  const identity = await prisma.identity.findFirst({ where: { id: parsed.data.identityId, userId: ready.user.id, status: "verified" } });
  if (!identity) return NextResponse.json({ error: "Verified identity not found." }, { status: 404 });
  const wallet = await prisma.wallet.findFirst({ where: { userId: ready.profile.id, status: "active" }, orderBy: { updatedAt: "desc" } });
  if (!wallet || !isAddress(wallet.address)) return NextResponse.json({ error: "Create or reconnect an active Arc-compatible wallet before binding payouts.", recoveryUrl: "/profile?section=wallet" }, { status: 409 });
  const now = new Date();
  const payout = await prisma.$transaction(async (tx) => {
    const existing = await tx.payoutDestination.findFirst({ where: { identityId: identity.id, walletId: wallet.id, network: wallet.network, address: wallet.address } });
    const row = existing ? await tx.payoutDestination.update({ where: { id: existing.id }, data: { status: "verified", verifiedAt: now, proofJson: json({ walletId: wallet.id, custodyType: wallet.custodyType, verifiedBy: "app_wallet_inventory" }) } }) : await tx.payoutDestination.create({ data: { userId: ready.profile.id, identityId: identity.id, walletId: wallet.id, network: wallet.network, address: wallet.address, asset: "USDC", status: "verified", verifiedAt: now, proofJson: json({ walletId: wallet.id, custodyType: wallet.custodyType, verifiedBy: "app_wallet_inventory" }) } });
    const blocked = await tx.obligation.findMany({ where: { identityId: identity.id, payoutDestinationId: null, blockerCode: "payout_destination_required" }, select: { id: true } });
    await tx.obligation.updateMany({ where: { id: { in: blocked.map((item) => item.id) } }, data: { payoutDestinationId: row.id, status: "recognized", blockerCode: null } });
    await tx.earningsLedgerEntry.updateMany({ where: { obligationId: { in: blocked.map((item) => item.id) }, state: "awaiting_authorization" }, data: { state: "recognized" } });
    await tx.actionRun.upsert({ where: { idempotencyKey: `identity.set_payout_destination:${identity.id}:${wallet.id}` }, create: { userId: ready.user.id, actionId: "identity.set_payout_destination", aggregateType: "PayoutDestination", aggregateId: row.id, idempotencyKey: `identity.set_payout_destination:${identity.id}:${wallet.id}`, state: "completed", recommendationReason: "The destination is an active app-owned wallet and is bound to a verified contributor identity.", input: { identityId: identity.id, walletId: wallet.id }, output: { payoutDestinationId: row.id, status: "verified", unblockedObligations: blocked.length }, completedAt: now }, update: {} });
    return row;
  });
  return NextResponse.json({ ok: true, payoutDestinationId: payout.id, status: payout.status });
}
