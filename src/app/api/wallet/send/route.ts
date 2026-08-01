import { NextResponse } from "next/server";
import { z } from "zod";
import { isAddress } from "viem";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { sendIdentityUsdc } from "@/lib/wallet/send-identity-usdc";

const bodySchema = z.object({
  destinationAddress: z.string().optional(),
  recipientUserId: z.string().min(1).optional(),
  amountUsd: z.number().min(0.01).max(10_000),
}).refine((value) => Boolean(value.destinationAddress) !== Boolean(value.recipientUserId), {
  message: "Choose either a destination address or a verified recipient.",
});

async function verifiedRecipient(recipientUserId: string) {
  return prisma.payoutDestination.findFirst({
    where: {
      userId: recipientUserId,
      identityId: null,
      status: "verified",
      verifiedAt: { not: null },
      network: "ARC-TESTNET",
      asset: "USDC",
    },
    orderBy: { verifiedAt: "desc" },
    select: { address: true, network: true, asset: true },
  });
}

export async function GET(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const recipientUserId = new URL(req.url).searchParams.get("recipientUserId")?.trim();
  if (!recipientUserId || recipientUserId === ready.user.id) {
    return NextResponse.json({ error: "Choose another verified recipient." }, { status: 400 });
  }
  const payout = await verifiedRecipient(recipientUserId);
  if (!payout) {
    return NextResponse.json({ error: "This recipient has no verified payout destination." }, { status: 409 });
  }
  return NextResponse.json({
    destinationAddress: payout.address,
    network: payout.network,
    asset: payout.asset,
  });
}

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid send request" }, { status: 400 });
  }

  let destinationAddress = parsed.data.destinationAddress;
  if (parsed.data.recipientUserId) {
    if (parsed.data.recipientUserId === ready.user.id) {
      return NextResponse.json({ error: "Choose another verified recipient." }, { status: 400 });
    }
    const payout = await verifiedRecipient(parsed.data.recipientUserId);
    if (!payout) {
      return NextResponse.json({ error: "This recipient has no verified payout destination." }, { status: 409 });
    }
    destinationAddress = payout.address;
  }
  if (!destinationAddress || !isAddress(destinationAddress)) {
    return NextResponse.json({ error: "Invalid send request" }, { status: 400 });
  }

  try {
    const result = await sendIdentityUsdc({
      user: ready.profile,
      destinationAddress,
      amountUsd: parsed.data.amountUsd,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      message: `$${result.amountUsd.toFixed(2)} USDC sent on Arc`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Send failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
