import { randomUUID } from "crypto";
import { getAddress, isAddress } from "viem";
import { prisma } from "@/lib/db";
import type { User } from "@prisma/client";
import { getCircleClient } from "@/lib/settlement/circle-client";
import { verifyArcTx } from "@/lib/settlement/arc-verify";
import {
  appWalletProvider,
  circleWalletIdForUser,
} from "@/lib/wallet/app-wallet-service";
import { getRealSpendableUsd } from "@/lib/wallet/sync-identity-balance";

export const MIN_SEND_USD = 0.01;
const GAS_RESERVE_USD = 0.05;

function round(n: number) {
  return Math.round(n * 100) / 100;
}

async function waitForCircleTransfer(
  circle: NonNullable<Awaited<ReturnType<typeof getCircleClient>>>,
  transactionId: string,
) {
  const maxAttempts = 40;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await circle.getTransaction({ id: transactionId });
    const state = res.data?.transaction?.state;
    const txHash = res.data?.transaction?.txHash;

    if (state === "COMPLETE" && txHash) {
      const verified = await verifyArcTx(txHash);
      if (verified.found && verified.success) {
        return { txHash, amountUsd: null as number | null };
      }
      if (verified.found && !verified.success) {
        throw new Error("Transfer failed on Arc");
      }
    }

    if (state === "FAILED" || state === "DENIED" || state === "CANCELLED") {
      throw new Error(`Transfer failed in Circle: ${state}`);
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  throw new Error("Transfer timed out waiting for Circle confirmation");
}

export async function sendIdentityUsdc(input: {
  user: User;
  destinationAddress: string;
  amountUsd: number;
}): Promise<{ txHash: string; amountUsd: number; availableUsd: number }> {
  if (!isAddress(input.destinationAddress)) {
    throw new Error("Invalid destination address");
  }

  const destination = getAddress(input.destinationAddress);
  const amountUsd = round(input.amountUsd);
  if (amountUsd < MIN_SEND_USD) {
    throw new Error(`Minimum send is $${MIN_SEND_USD.toFixed(2)}`);
  }

  if (!input.user.walletAddress) {
    throw new Error("No RESOLVE wallet on your account");
  }

  if (destination.toLowerCase() === input.user.walletAddress.toLowerCase()) {
    throw new Error("Destination must be a different address");
  }

  const spendable = await getRealSpendableUsd(input.user.id, { sync: true });
  const maxSend = round(Math.max(0, spendable.availableUsd - GAS_RESERVE_USD));
  if (amountUsd > maxSend + 0.000001) {
    throw new Error(
      maxSend <= 0
        ? "Not enough USDC to send (keep a small amount for Arc gas)"
        : `You can send up to $${maxSend.toFixed(2)}`,
    );
  }

  const provider = appWalletProvider(input.user);
  const circleWalletId = circleWalletIdForUser(input.user);
  if (provider !== "circle" || !circleWalletId) {
    throw new Error("Send is available for Circle-backed RESOLVE wallets only");
  }

  const circle = await getCircleClient();
  if (!circle) {
    throw new Error("Circle is not configured for outbound transfers");
  }

  const refLabel = `send:${randomUUID()}`;
  // Circle SDK types lag Arc testnet; runtime supports ARC-TESTNET native USDC.
  const res = await circle.createTransaction({
    idempotencyKey: randomUUID(),
    walletId: circleWalletId,
    tokenAddress: "",
    blockchain: "ARC-TESTNET",
    destinationAddress: destination,
    amount: [amountUsd.toFixed(6)],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  } as never);

  const txId = res.data?.id;
  if (!txId) throw new Error("Circle did not return a transaction id");

  const { txHash } = await waitForCircleTransfer(circle, txId);

  const [updated] = await prisma.$transaction([
    prisma.user.update({
      where: { id: input.user.id },
      data: { availableUsd: { decrement: amountUsd } },
    }),
    prisma.walletTransaction.create({
      data: {
        userId: input.user.id,
        type: "withdrawal",
        method: "crypto",
        amountUsd,
        label: `${refLabel}:${txHash}`,
        status: "completed",
      },
    }),
  ]);

  await getRealSpendableUsd(input.user.id, { sync: true });

  return {
    txHash,
    amountUsd,
    availableUsd: round(updated.availableUsd),
  };
}
