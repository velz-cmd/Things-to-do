import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { linkWalletToGithub, extractGithubIdentity } from "@/lib/identity/contributors";
import {
  getClaimableItemsForUser,
  markRewardSettled,
} from "@/lib/identity/pending-rewards";
import { markAuthorizationSettled } from "@/lib/authorization/ledger";
import { settleClaimBatch } from "@/lib/banking/claim-settlement";
import { buildFxSwapHint } from "@/lib/settlement/fx";
import { getContributorPayoutPreference } from "@/lib/identity/contributors";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const bodySchema = z.object({
  walletAddress: z.string(),
  rewardIds: z.array(z.string()).optional(),
  authorizationIds: z.array(z.string()).optional(),
});

type ClaimedItem = {
  id: string;
  source: "authorization" | "legacy_reward";
  amountUsd: number;
  txHash?: string;
  status: string;
};

/** Contributor claims — batched Arc memo payout to RESOLVE identity wallet. */
export async function POST(req: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const requestedKey = req.headers.get("idempotency-key");
  if (requestedKey) {
    const replay = await prisma.actionRun.findUnique({ where: { idempotencyKey: requestedKey } });
    if (replay?.state === "completed" && replay.output) return NextResponse.json({ ...(replay.output as Record<string, unknown>), replayed: true });
    if (replay && ["validating", "running", "pending_external"].includes(replay.state)) return NextResponse.json({ error: "Collection is already in progress", actionRunId: replay.id }, { status: 409 });
  }
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success || !parsed.data.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    return NextResponse.json({ error: "Valid walletAddress required" }, { status: 400 });
  }

  const profile = await ensureProfileForUser(session.user);
  const { login } = extractGithubIdentity(session.user);
  const githubUsername = login ?? profile.githubUsername;

  const payoutWallet = profile.walletAddress ?? parsed.data.walletAddress;
  if (!payoutWallet) {
    return NextResponse.json({ error: "No RESOLVE wallet on your account" }, { status: 400 });
  }

  if (
    profile.walletAddress &&
    parsed.data.walletAddress.toLowerCase() !== profile.walletAddress.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Earnings are sent to your RESOLVE wallet on file" },
      { status: 400 },
    );
  }

  if (githubUsername) {
    await linkWalletToGithub({
      login: githubUsername,
      walletAddress: payoutWallet,
      userId: session.user.id,
    });
  }

  const { authorizations, legacyRewards } = await getClaimableItemsForUser({
    githubUsername,
    walletAddress: payoutWallet,
    profile,
    authUser: session.user,
  });

  const authToClaim =
    parsed.data.authorizationIds?.length ?
      authorizations.filter(
        (a) => parsed.data.authorizationIds!.includes(a.id) && a.status === "claimable",
      )
    : authorizations;

  const rewardsToClaim =
    parsed.data.rewardIds?.length ?
      legacyRewards.filter(
        (r) => parsed.data.rewardIds!.includes(r.id) && r.status === "claimable",
      )
    : legacyRewards;

  if (!authToClaim.length && !rewardsToClaim.length) {
    return NextResponse.json(
      { error: "Nothing to collect right now", claimed: [], totalUsd: 0 },
      { status: 404 },
    );
  }

  const claimItems = [
    ...authToClaim.map((a) => ({
      id: a.id,
      source: "authorization" as const,
      amountUsd: a.amountUsd,
      missionId: a.missionId,
      contextLabel: a.contextLabel,
      proofHash: a.proofHash,
      settlementId: a.settlementId,
      connectorId: a.connectorId,
    })),
    ...rewardsToClaim.map((r) => ({
      id: r.id,
      source: "legacy_reward" as const,
      amountUsd: r.amountUsd,
      missionId: r.missionId,
      repo: r.repo,
      proofHash: r.proofHash,
      settlementId: r.settlementId,
    })),
  ];
  const idempotencyKey = requestedKey ?? `capital.collect_earnings:${session.user.id}:${claimItems.map((item) => item.id).sort().join(",")}`;
  const actionRun = await prisma.actionRun.upsert({
    where: { idempotencyKey },
    create: { userId: session.user.id, actionId: "capital.collect_earnings", aggregateType: "EarningClaim", idempotencyKey, state: "pending_external", recommendationReason: "Only currently claimable, attributed earnings are included in the settlement batch.", input: { walletAddress: payoutWallet, claimItemIds: claimItems.map((item) => item.id) } },
    update: {},
  });

  let batchTxHash: string | undefined;
  let batchMemo: string | undefined;
  let batchId: string | undefined;
  let settlementFailed = false;

  try {
    const settlement = await settleClaimBatch({
      githubUsername: githubUsername ?? payoutWallet.slice(0, 10),
      walletAddress: payoutWallet,
      items: claimItems.map((i) => ({
        id: i.id,
        source: i.source,
        amountUsd: i.amountUsd,
        missionId: i.missionId,
        contextLabel: "contextLabel" in i ? i.contextLabel : undefined,
        repo: "repo" in i ? i.repo : undefined,
        proofHash: i.proofHash,
      })),
    });

    batchId = settlement.batchId;
    if ("txHash" in settlement) {
      batchTxHash = settlement.txHash;
      batchMemo = settlement.memo;
    } else {
      batchTxHash = `offchain-${settlement.batchId.slice(0, 24)}`;
    }
  } catch (e) {
    console.error("[claim] Arc batch settlement failed:", e);
    settlementFailed = true;
  }

  const claimed: ClaimedItem[] = [];

  for (const item of claimItems) {
    if (settlementFailed) {
      claimed.push({
        id: item.id,
        source: item.source,
        amountUsd: item.amountUsd,
        status: "failed",
      });
      continue;
    }

    const txHash = batchTxHash;

    if (item.source === "authorization") {
      await markAuthorizationSettled(item.id, {
        settlementId: item.settlementId ?? undefined,
        walletAddress: payoutWallet,
      });

      if (item.settlementId) {
        await prisma.paymentEvent
          .create({
            data: {
              settlementId: item.settlementId,
              type: "AuthorizationClaimed",
              payloadJson: JSON.stringify({
                authorizationId: item.id,
                connectorId: "connectorId" in item ? item.connectorId : undefined,
                githubUsername,
                amountUsd: item.amountUsd,
                txHash,
                batchId,
                memo: batchMemo,
                arcBatch: true,
              }),
            },
          })
          .catch(() => {
            /* non-fatal */
          });
      }
    } else {
      await markRewardSettled(item.id, {
        walletAddress: payoutWallet,
        txHash,
      });

      if (item.settlementId) {
        await prisma.paymentEvent
          .create({
            data: {
              settlementId: item.settlementId,
              type: "RewardClaimed",
              payloadJson: JSON.stringify({
                rewardId: item.id,
                githubUsername,
                amountUsd: item.amountUsd,
                txHash,
                batchId,
                memo: batchMemo,
                arcBatch: true,
              }),
            },
          })
          .catch(() => {
            /* non-fatal */
          });
      }
    }

    claimed.push({
      id: item.id,
      source: item.source,
      amountUsd: item.amountUsd,
      txHash,
      status: "settled",
    });
  }

  const totalUsd = claimed
    .filter((c) => c.status === "settled")
    .reduce((s, c) => s + c.amountUsd, 0);

  const payoutCurrency =
    githubUsername ?
      await getContributorPayoutPreference(githubUsername)
    : "USDC";
  const fxHint = buildFxSwapHint(totalUsd, payoutCurrency);

  const output = {
    ok: !settlementFailed,
    githubUsername,
    walletAddress: payoutWallet,
    claimed,
    totalUsd: Math.round(totalUsd * 100) / 100,
    payoutCurrency,
    fxHint,
    batchId,
    arcBatch: true,
  };
  const persistedOutput = JSON.parse(JSON.stringify(output)) as Prisma.InputJsonValue;
  await prisma.actionRun.update({ where: { id: actionRun.id }, data: { state: settlementFailed ? "sync_failed" : "completed", output: persistedOutput, errorCode: settlementFailed ? "ARC_SETTLEMENT_FAILED" : null, errorMessage: settlementFailed ? "Arc settlement did not confirm; claim items remain recoverable." : null, completedAt: new Date() } });
  return NextResponse.json({ ...output, actionRunId: actionRun.id }, { status: settlementFailed ? 502 : 200 });
}
