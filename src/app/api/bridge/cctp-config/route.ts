import { NextResponse } from "next/server";
import { isHash } from "viem";
import { prisma } from "@/lib/db";
import { requireReadyUser } from "@/lib/auth/session";
import { syncIdentityBalance } from "@/lib/wallet/sync-identity-balance";
import { verifyArcDepositToWallet } from "@/lib/wallet/verify-bridge-deposit";

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
  const { mintTxHash } = body as { mintTxHash?: string };

  if (!mintTxHash || !isHash(mintTxHash)) {
    return NextResponse.json({ error: "Valid mintTxHash required" }, { status: 400 });
  }

  if (!ready.profile.walletAddress) {
    return NextResponse.json({ error: "No RESOLVE wallet on profile" }, { status: 400 });
  }

  const existing = await prisma.walletTransaction.findFirst({
    where: { userId: ready.user.id, label: mintTxHash, type: "deposit" },
  });
  if (existing) {
    const sync = await syncIdentityBalance(ready.user.id);
    return NextResponse.json({
      ok: true,
      message: "Bridge deposit already recorded",
      availableUsd: sync.availableUsd,
    });
  }

  const verified = await verifyArcDepositToWallet({
    txHash: mintTxHash,
    depositAddress: ready.profile.walletAddress,
  });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }

  await prisma.walletTransaction.create({
    data: {
      userId: ready.user.id,
      type: "deposit",
      method: "cctp_bridge",
      amountUsd: verified.amountUsd,
      label: mintTxHash,
      status: "completed",
    },
  });

  const sync = await syncIdentityBalance(ready.user.id);

  return NextResponse.json({
    ok: true,
    message: `$${verified.amountUsd.toFixed(2)} synced from CCTP bridge`,
    availableUsd: sync.availableUsd,
    onChainUsd: sync.onChainUsd,
  });
}
