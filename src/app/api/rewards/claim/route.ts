import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { linkWalletToGithub, extractGithubIdentity } from "@/lib/identity/contributors";
import {
  getClaimableItemsForGithub,
  markRewardSettled,
} from "@/lib/identity/pending-rewards";
import { markAuthorizationSettled } from "@/lib/authorization/ledger";
import { settleClaimBatch } from "@/lib/banking/claim-settlement";
import { buildFxSwapHint } from "@/lib/settlement/fx";
import { getContributorPayoutPreference } from "@/lib/identity/contributors";
import { prisma } from "@/lib/db";

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

/** Contributor claims — batched Arc memo payout to identity wallet (one tx per claim action). */
export async function POST(req: Request) {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success || !parsed.data.walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
    return NextResponse.json({ error: "Valid walletAddress required" }, { status: 400 });
  }

  const profile = await ensureProfileForUser(session.user);
  const { login } = extractGithubIdentity(session.user);
  const githubUsername = login ?? profile.githubUsername;

  if (!githubUsername) {
    return NextResponse.json(
      { error: "Sign in with GitHub to claim rewards" },
      { status: 403 },
    );
  }

  const payoutWallet = profile.walletAddress ?? parsed.data.walletAddress;
  if (
    profile.walletAddress &&
    parsed.data.walletAddress.toLowerCase() !== profile.walletAddress.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "Earnings are sent to your RESOLVE wallet on file" },
      { status: 400 },
    );
  }

  await linkWalletToGithub({
    login: githubUsername,
    walletAddress: payoutWallet,
    userId: session.user.id,
  });

  const { authorizations, legacyRewards } = await getClaimableItemsForGithub(githubUsername);

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
    return NextResponse.json({ error: "No claimable authorizations", claimed: [] });
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

  let batchTxHash: string | undefined;
  let batchMemo: string | undefined;
  let batchId: string | undefined;
  let settlementFailed = false;

  try {
    const settlement = await settleClaimBatch({
      githubUsername,
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

  const payoutCurrency = await getContributorPayoutPreference(githubUsername);
  const fxHint = buildFxSwapHint(totalUsd, payoutCurrency);

  return NextResponse.json({
    ok: !settlementFailed,
    githubUsername,
    walletAddress: payoutWallet,
    claimed,
    totalUsd: Math.round(totalUsd * 100) / 100,
    payoutCurrency,
    fxHint,
    batchId,
    arcBatch: true,
  });
}
