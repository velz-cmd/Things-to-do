import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";
import { verifyArcTx } from "@/lib/settlement/arc-verify";

/** CCTP Sepolia → Arc testnet configuration (Circle docs) */
export async function GET() {
  return NextResponse.json({
    sourceChain: "Ethereum Sepolia",
    sourceChainId: 11155111,
    sourceDomain: 0,
    destinationChain: "Arc Testnet",
    destinationChainId: 5042002,
    destinationDomain: 26,
    sepoliaUsdc: "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238",
    tokenMessenger: "0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa",
    arcMessageTransmitter: "0xe737e5cebeeba77efe34d4aa090756590b1ce275",
    attestationApi: "https://iris-api-sandbox.circle.com/v2/messages/0",
    faucetUrl: "https://faucet.circle.com",
    docsUrl:
      "https://developers.circle.com/cctp/quickstarts/transfer-usdc-ethereum-to-arc",
  });
}

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const body = await req.json();
  const { mintTxHash, amountUsd } = body as {
    mintTxHash?: string;
    amountUsd?: number;
  };

  if (!mintTxHash || !amountUsd) {
    return NextResponse.json({ error: "Missing mintTxHash or amountUsd" }, { status: 400 });
  }

  const verified = await verifyArcTx(mintTxHash);
  if (!verified.found || !verified.success) {
    return NextResponse.json(
      { error: "Mint transaction not confirmed on Arc yet" },
      { status: 400 }
    );
  }

  const existing = await prisma.walletTransaction.findFirst({
    where: { label: mintTxHash, type: "deposit" },
  });
  if (existing) {
    return NextResponse.json({ ok: true, message: "Bridge deposit already credited" });
  }

  await prisma.user.update({
    where: { id: ready.user.id },
    data: { availableUsd: { increment: amountUsd } },
  });

  await prisma.walletTransaction.create({
    data: {
      userId: ready.user.id,
      type: "deposit",
      method: "cctp_bridge",
      amountUsd,
      label: mintTxHash,
      status: "completed",
    },
  });

  return NextResponse.json({
    ok: true,
    message: `$${amountUsd.toFixed(2)} credited from CCTP bridge`,
  });
}
