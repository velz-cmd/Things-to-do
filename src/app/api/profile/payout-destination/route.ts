import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { isAddress, verifyMessage } from "viem";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { cacheDelete } from "@/lib/cache/kv";
import { prisma } from "@/lib/db";
import { invalidateConnectorCaches } from "@/lib/profile/invalidate-connector-cache";
import { buildPayoutOwnershipMessage } from "@/lib/profile/payout-ownership-proof";
import { appWalletProvider, circleWalletIdForUser } from "@/lib/wallet/app-wallet-service";

const requestSchema = z.object({
  walletType: z.enum(["app", "external"]),
  confirm: z.literal(true),
  idempotencyKey: z.string().min(8).max(160),
  ownershipProof: z.object({
    message: z.string().min(20).max(500),
    signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  }).optional(),
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
  if (parsed.data.walletType === "external") {
    const expectedMessage = buildPayoutOwnershipMessage(address, parsed.data.idempotencyKey);
    if (parsed.data.ownershipProof?.message !== expectedMessage) {
      return NextResponse.json({ error: "Sign the current RESOLVE payout request with the connected wallet." }, { status: 409 });
    }
    const verified = await verifyMessage({
      address: address as `0x${string}`,
      message: expectedMessage,
      signature: parsed.data.ownershipProof.signature as `0x${string}`,
    }).catch(() => false);
    if (!verified) {
      return NextResponse.json({ error: "The wallet signature did not match the selected payout address." }, { status: 409 });
    }
  }
  const payoutStatus = "verified";
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
          verification: parsed.data.walletType === "app" ? "app_wallet_inventory" : "signed_wallet_ownership",
          signature: parsed.data.ownershipProof?.signature,
        }),
      },
    });

    let identityDestinationCount = 0;
    let unblockedObligations = 0;
    if (payoutStatus === "verified") {
      const identities = await tx.identity.findMany({
        where: { userId: ready.user.id, status: "verified" },
        select: { id: true },
      });

      for (const identity of identities) {
        await tx.payoutDestination.updateMany({
          where: {
            userId: ready.user.id,
            identityId: identity.id,
            status: { in: ["pending", "verified"] },
          },
          data: { status: "superseded" },
        });

        const identityPayout = await tx.payoutDestination.create({
          data: {
            userId: ready.user.id,
            identityId: identity.id,
            walletId: wallet.id,
            network: wallet.network,
            address: wallet.address,
            asset: "USDC",
            status: "verified",
            verifiedAt: now,
            proofJson: json({
              inheritedFromPayoutDestinationId: payout.id,
              walletId: wallet.id,
              custodyType,
              selectedBy: ready.user.id,
              verification: parsed.data.walletType === "app"
                ? "app_wallet_inventory"
                : "signed_wallet_ownership",
            }),
          },
        });
        identityDestinationCount += 1;

        const blocked = await tx.obligation.findMany({
          where: {
            identityId: identity.id,
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
              payoutDestinationId: identityPayout.id,
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
          unblockedObligations += obligationIds.length;
        }
      }
    }

    const output = {
      payoutDestinationId: payout.id,
      status: payout.status,
      walletId: wallet.id,
      identityDestinationCount,
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
        recommendationReason: parsed.data.walletType === "app"
          ? "The selected destination is an application-managed Arc wallet."
          : "The selected destination was verified by a user-signed ownership proof.",
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
    invalidateConnectorCaches(ready.user.id),
    cacheDelete(`capital:bootstrap:${ready.user.id}`),
  ]);

  return NextResponse.json({ ok: true, ...result });
}
