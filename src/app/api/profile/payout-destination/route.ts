import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { isAddress } from "viem";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { cacheDelete } from "@/lib/cache/kv";
import { prisma } from "@/lib/db";
import { appWalletProvider, circleWalletIdForUser } from "@/lib/wallet/app-wallet-service";

const requestSchema = z.object({
  walletType: z.enum(["app", "external"]),
  confirm: z.literal(true),
  idempotencyKey: z.string().min(8).max(160),
});

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export async function POST(request: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Confirm an available wallet before changing the payout destination." },
      { status: 400 },
    );
  }

  const address = (
    parsed.data.walletType === "app"
      ? ready.profile.walletAddress
      : ready.profile.scanWalletAddress
  )?.toLowerCase();
  if (!address || !isAddress(address)) {
    return NextResponse.json(
      {
        error:
          parsed.data.walletType === "app"
            ? "The RESOLVE wallet is not available. Open Capital and retry wallet setup."
            : "Connect a valid external wallet before selecting it for payouts.",
        recoveryUrl: parsed.data.walletType === "app" ? "/capital" : "/profile?view=wallets",
      },
      { status: 409 },
    );
  }

  const provider =
    parsed.data.walletType === "app" ? appWalletProvider(ready.profile) : "reown";
  const custodyType =
    parsed.data.walletType === "app" ? "developer_controlled" : "external";
  const payoutStatus = parsed.data.walletType === "app" ? "verified" : "pending";
  const now = new Date();
  const actionKey = `profile.set_payout_destination:${ready.user.id}:${parsed.data.idempotencyKey}`;

  const result = await prisma.$transaction(async (tx) => {
    const prior = await tx.actionRun.findUnique({ where: { idempotencyKey: actionKey } });
    if (prior?.output && typeof prior.output === "object") {
      return prior.output as { payoutDestinationId?: string; status?: string };
    }

    const wallet = await tx.wallet.upsert({
      where: { provider_network_address: { provider, network: "ARC-TESTNET", address } },
      create: {
        userId: ready.user.id,
        ownerType: "human",
        custodyType,
        provider,
        providerWalletId:
          parsed.data.walletType === "app" ? circleWalletIdForUser(ready.profile) : null,
        network: "ARC-TESTNET",
        address,
        status: "active",
      },
      update: {
        userId: ready.user.id,
        ownerType: "human",
        custodyType,
        providerWalletId:
          parsed.data.walletType === "app" ? circleWalletIdForUser(ready.profile) : undefined,
        status: "active",
      },
    });

    await tx.payoutDestination.updateMany({
      where: { userId: ready.user.id, identityId: null, status: { in: ["pending", "verified"] } },
      data: { status: "superseded" },
    });

    const payout = await tx.payoutDestination.create({
      data: {
        userId: ready.user.id,
        walletId: wallet.id,
        network: wallet.network,
        address: wallet.address,
        asset: "USDC",
        status: payoutStatus,
        verifiedAt: payoutStatus === "verified" ? now : null,
        proofJson: json({
          walletId: wallet.id,
          custodyType,
          selectedBy: ready.user.id,
          verification:
            payoutStatus === "verified"
              ? "app_wallet_inventory"
              : "external_wallet_proof_required",
        }),
      },
    });

    let unblockedObligations = 0;
    if (payoutStatus === "verified") {
      const identities = await tx.identity.findMany({
        where: { userId: ready.user.id, status: "verified" },
        select: { id: true },
      });
      const identityIds = identities.map((identity) => identity.id);
      if (identityIds.length) {
        const blocked = await tx.obligation.findMany({
          where: {
            identityId: { in: identityIds },
            payoutDestinationId: null,
            blockerCode: "payout_destination_required",
          },
          select: { id: true },
        });
        const obligationIds = blocked.map((obligation) => obligation.id);
        if (obligationIds.length) {
          await tx.obligation.updateMany({
            where: { id: { in: obligationIds } },
            data: {
              payoutDestinationId: payout.id,
              status: "recognized",
              blockerCode: null,
            },
          });
          await tx.earningsLedgerEntry.updateMany({
            where: {
              obligationId: { in: obligationIds },
              state: "awaiting_authorization",
            },
            data: { state: "recognized" },
          });
          unblockedObligations = obligationIds.length;
        }
      }
    }

    const output = {
      payoutDestinationId: payout.id,
      status: payout.status,
      walletId: wallet.id,
      unblockedObligations,
    };
    await tx.actionRun.create({
      data: {
        userId: ready.user.id,
        actionId: "profile.set_payout_destination",
        aggregateType: "PayoutDestination",
        aggregateId: payout.id,
        idempotencyKey: actionKey,
        state: "completed",
        recommendationReason:
          payoutStatus === "verified"
            ? "The selected destination is an application-managed Arc wallet."
            : "The external destination is recorded but remains pending ownership proof.",
        input: json({ walletType: parsed.data.walletType, address }),
        output: json(output),
        completedAt: now,
      },
    });
    await tx.operationalEvent.create({
      data: {
        eventType: "profile.payout_destination_selected",
        aggregateType: "PayoutDestination",
        aggregateId: payout.id,
        userId: ready.user.id,
        correlationId: randomUUID(),
        idempotencyKey: `event:${actionKey}`,
        payload: json({ walletType: parsed.data.walletType, address, status: payoutStatus }),
        occurredAt: now,
      },
    });
    return output;
  });

  await Promise.all([
    cacheDelete(`profile:control-plane:${ready.user.id}`),
    cacheDelete(`profile:state:${ready.user.id}`),
    cacheDelete(`capital:bootstrap:${ready.user.id}`),
  ]);

  return NextResponse.json({ ok: true, ...result });
}
