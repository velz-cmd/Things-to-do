import { getAddress, isAddress } from "viem";
import {
  getCircleClient,
  getCircleClientWithSecret,
  resetCircleClientCache,
} from "@/lib/settlement/circle-client";
import { ensureCircleEntitySecret } from "@/lib/wallet/circle-config";
import { circleErrorMessage } from "@/lib/wallet/circle-errors";
import { circleIdempotencyKey, circleIdempotencyKeyRandom } from "@/lib/wallet/circle-idempotency";
import { ARC_CLIENT_WALLET_ID } from "@/lib/settlement/arc-config";
import { verifyArcTx } from "@/lib/settlement/arc-verify";
import {
  appWalletProvider,
  circleWalletIdForUser,
} from "@/lib/wallet/app-wallet-service";
import type { User } from "@prisma/client";

export const ARC_GAS_RESERVE_USD = 0.05;

async function circleClientForTransfers() {
  const secretResult = await ensureCircleEntitySecret();
  resetCircleClientCache();
  const circle = await getCircleClientWithSecret(secretResult.entitySecret);
  if (!circle) throw new Error("Circle is not configured for Arc transfers");
  return circle;
}

function resolveIdempotencyKey(seed?: string): string {
  if (!seed) return circleIdempotencyKeyRandom();
  return circleIdempotencyKey(seed);
}

export async function waitForCircleArcTransfer(
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
        return { txHash, verified: true as const };
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

  throw new Error("Transfer timed out waiting for Arc confirmation");
}

/** Send USDC on Arc testnet from the user's Circle RESOLVE wallet. */
export async function sendUsdcFromUserCircleWallet(input: {
  user: User;
  destinationAddress: string;
  amountUsd: number;
  idempotencyKey?: string;
}): Promise<{ txHash: string; circleTransactionId: string }> {
  if (!isAddress(input.destinationAddress)) {
    throw new Error("Invalid destination address");
  }

  const destination = getAddress(input.destinationAddress);
  const amountUsd = Math.round(input.amountUsd * 1_000_000) / 1_000_000;
  if (amountUsd <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  if (!input.user.walletAddress) {
    throw new Error("No RESOLVE wallet on your account");
  }

  const provider = appWalletProvider(input.user);
  const circleWalletId = circleWalletIdForUser(input.user);
  if (provider !== "circle" || !circleWalletId) {
    throw new Error("Agent signals require a Circle-backed RESOLVE wallet with USDC on Arc");
  }

  const circle = await circleClientForTransfers();

  try {
    const res = await circle.createTransaction({
      idempotencyKey: resolveIdempotencyKey(input.idempotencyKey),
      walletId: circleWalletId,
      tokenAddress: "",
      blockchain: "ARC-TESTNET",
      destinationAddress: destination,
      amount: [amountUsd.toFixed(6)],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    } as never);

    const circleTransactionId = res.data?.id;
    if (!circleTransactionId) throw new Error("Circle did not return a transaction id");

    const { txHash } = await waitForCircleArcTransfer(circle, circleTransactionId);
    return { txHash, circleTransactionId };
  } catch (err) {
    throw new Error(circleErrorMessage(err));
  }
}

/** Fund a user Circle wallet from the RESOLVE treasury (ARC_CLIENT_WALLET). */
export async function sendUsdcFromTreasuryCircleWallet(input: {
  destinationAddress: string;
  amountUsd: number;
  idempotencyKey?: string;
}): Promise<{ txHash: string; circleTransactionId: string }> {
  if (!ARC_CLIENT_WALLET_ID) {
    throw new Error("ARC_CLIENT_WALLET_ID not configured");
  }
  if (!isAddress(input.destinationAddress)) {
    throw new Error("Invalid destination address");
  }

  const destination = getAddress(input.destinationAddress);
  const amountUsd = Math.round(input.amountUsd * 1_000_000) / 1_000_000;
  if (amountUsd <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  const circle = await circleClientForTransfers();

  try {
    const res = await circle.createTransaction({
      idempotencyKey: resolveIdempotencyKey(input.idempotencyKey),
      walletId: ARC_CLIENT_WALLET_ID,
      tokenAddress: "",
      blockchain: "ARC-TESTNET",
      destinationAddress: destination,
      amount: [amountUsd.toFixed(6)],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    } as never);

    const circleTransactionId = res.data?.id;
    if (!circleTransactionId) throw new Error("Circle did not return a transaction id");

    const { txHash } = await waitForCircleArcTransfer(circle, circleTransactionId);
    return { txHash, circleTransactionId };
  } catch (err) {
    throw new Error(circleErrorMessage(err));
  }
}
