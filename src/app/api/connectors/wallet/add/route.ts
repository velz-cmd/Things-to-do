import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const body = await req.json();
  const address = String(body.address ?? "").trim().toLowerCase();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  const identityOwner = await prisma.user.findFirst({
    where: {
      walletAddress: address,
      embeddedWallet: true,
      id: { not: ready.user.id },
    },
    select: { id: true },
  });
  if (identityOwner) {
    return NextResponse.json(
      { error: "That address is another member's RESOLVE wallet" },
      { status: 409 },
    );
  }

  if (ready.profile.walletAddress?.toLowerCase() === address) {
    return NextResponse.json({ ok: true, address: ready.profile.walletAddress });
  }

  await prisma.user.update({
    where: { id: ready.user.id },
    data: { scanWalletAddress: address },
  });

  return NextResponse.json({ ok: true, address });
}
