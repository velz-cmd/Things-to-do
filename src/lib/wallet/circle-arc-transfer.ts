import { getAddress, isAddress } from "viem";
import {
  getCircleClient,
  getCircleClientWithSecret,
  resetCircleClientCache,
} from "@/lib/settlement/circle-client";
import { requireCircleEntitySecret } from "@/lib/wallet/circle-config";
import { circleUserMessage } from "@/lib/wallet/circle-errors";
import { circleIdempotencyKey, circleIdempotencyKeyRandom } from "@/lib/wallet/circle-idempotency";
import { getResolvedArcClientWalletId } from "@/lib/settlement/arc-wallet-ids";
import { verifyArcTx } from "@/lib/settlement/arc-verify";
import {
  appWalletProvider,
  circleWalletIdForUser,
} from "@/lib/wallet/app-wallet-service";
import type { User } from "@prisma/client";

export const ARC_GAS_RESERVE_USD = 0.05;

export async function circleClientForTransfers() {
  const entitySecret = await requireCircleEntitySecret();
  resetCircleClientCache();
  const circle = await getCircleClientWithSecret(entitySecret);
  if (!circle) throw new Error("Circle payments are unavailable right now");
  return circle;
}

export type CircleArcTransferSnapshot =
  | { state: "complete"; txHash: string }
  | { state: "failed"; reason: string }
  | { state: "pending" };

export async function getCircleArcTransferSnapshot(
  circle: NonNullable<Awaited<ReturnType<typeof getCircleClient>>>,
  transactionId: string,
): Promise<CircleArcTransferSnapshot> {
  const res = await circle.getTransaction({ id: transactionId });
  const state = res.data?.transaction?.state;
  const txHash = res.data?.transaction?.txHash;

  if (state === "COMPLETE" && txHash) {
    const verified = await verifyArcTx(txHash);
    if (verified.found && verified.success) {
      return { state: "complete", txHash };
    }
    if (verified.found && !verified.success) {
      return { state: "failed", reason: "Transfer failed on Arc" };
    }
    return { state: "pending" };
  }

  if (state === "FAILED" || state === "DENIED" || state === "CANCELLED") {
    return { state: "failed", reason: `Transfer failed in Circle: ${state}` };
  }

  return { state: "pending" };
}

export async function waitForCircleArcTransfer(
  circle: NonNullable<Awaited<ReturnType<typeof getCircleClient>>>,
  transactionId: string,
  options?: { maxAttempts?: number },
) {
  const maxAttempts = options?.maxAttempts ?? 40;
  for (let i = 0; i < maxAttempts; i++) {
    const snapshot = await getCircleArcTransferSnapshot(circle, transactionId);
    if (snapshot.state === "complete") {
      return { txHash: snapshot.txHash, verified: true as const };
    }
    if (snapshot.state === "failed") {
      throw new Error(snapshot.reason);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  throw new Error("Transfer timed out waiting for Arc confirmation");
}

function resolveIdempotencyKey(seed?: string): string {
  if (!seed) return circleIdempotencyKeyRandom();
  return circleIdempotencyKey(seed);
}

/** Create a Circle USDC transfer without waiting for Arc confirmation. */
export async function createCircleUsdcTransfer(input: {
  walletId: string;
  destinationAddress: string;
  amountUsd: number;
  idempotencyKey?: string;
}): Promise<{ circleTransactionId: string }> {
  if (!isAddress(input.destinationAddress)) {
    throw new Error("Invalid destination address");
  }

  const destination = getAddress(input.destinationAddress);
  const amountUsd = Math.round(input.amountUsd * 1_000_000) / 1_000_000;
  if (amountUsd <= 0) {
    throw new Error("Amount must be greater than zero");
  }

  const circle = await circleClientForTransfers();
  const res = await circle.createTransaction({
    idempotencyKey: resolveIdempotencyKey(input.idempotencyKey),
    walletId: input.walletId,
    tokenAddress: "",
    blockchain: "ARC-TESTNET",
    destinationAddress: destination,
    amount: [amountUsd.toFixed(6)],
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  } as never);

  const circleTransactionId = res.data?.id;
  if (!circleTransactionId) throw new Error("Circle did not return a transaction id");
  return { circleTransactionId };
}

/** Send USDC on Arc testnet from the user's Circle RESOLVE wallet. */
export async function sendUsdcFromUserCircleWallet(input: {
  user: User;
  destinationAddress: string;
  amountUsd: number;
  idempotencyKey?: string;
  maxWaitAttempts?: number;
}): Promise<{ txHash: string; circleTransactionId: string }> {
  if (!isAddress(input.destinationAddress)) {
    throw new Error("Invalid destination address");
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
    const { circleTransactionId } = await createCircleUsdcTransfer({
      walletId: circleWalletId,
      destinationAddress: input.destinationAddress,
      amountUsd: input.amountUsd,
      idempotencyKey: input.idempotencyKey,
    });

    const { txHash } = await waitForCircleArcTransfer(circle, circleTransactionId, {
      maxAttempts: input.maxWaitAttempts,
    });
    return { txHash, circleTransactionId };
  } catch (err) {
    throw new Error(circleUserMessage(err));
  }
}

/** Fund a user Circle wallet from the RESOLVE treasury (ARC_CLIENT_WALLET). */
export async function sendUsdcFromTreasuryCircleWallet(input: {
  destinationAddress: string;
  amountUsd: number;
  idempotencyKey?: string;
}): Promise<{ txHash: string; circleTransactionId: string }> {
  const treasuryWalletId = await getResolvedArcClientWalletId();
  if (!treasuryWalletId) {
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
      walletId: treasuryWalletId,
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
    throw new Error(circleUserMessage(err));
  }
}
