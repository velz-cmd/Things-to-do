import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { linkWalletToGithub, extractGithubIdentity } from "@/lib/identity/contributors";
import {
  getClaimableItemsForGithub,
  markRewardSettled,
} from "@/lib/identity/pending-rewards";
import { markAuthorizationSettled } from "@/lib/authorization/ledger";
import { sendUsdcWithMemo } from "@/lib/arc/memo";
import { buildContributorMemo } from "@/lib/payment/memo";
import { isLiveArcEnabled } from "@/lib/settlement/arc-config";
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

/** Contributor claims claimable Authorizations — GitHub identity + wallet → Fulfillment */
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

  await linkWalletToGithub({
    login: githubUsername,
    walletAddress: parsed.data.walletAddress,
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

  const claimed: ClaimedItem[] = [];

  for (const auth of authToClaim) {
    const intent = {
      id: `claim:${auth.id}`,
      wallet: parsed.data.walletAddress,
      login: githubUsername,
      weight: auth.weight,
      amountUsd: auth.amountUsd,
      rank: 0,
      status: "processing" as const,
    };

    const memoText = buildContributorMemo({
      missionId: auth.missionId,
      repo: auth.contextLabel ?? undefined,
      intent,
      proofHash: auth.proofHash,
      batchNumber: 0,
    });

    let txHash: string | undefined;
    let status = "settled";

    if (isLiveArcEnabled()) {
      try {
        const result = await sendUsdcWithMemo({
          recipient: parsed.data.walletAddress as `0x${string}`,
          amountUsd: auth.amountUsd,
          memo: memoText,
          memoRef: `claim:${auth.id}:${githubUsername}`,
        });
        txHash = result.txHash;
      } catch (e) {
        console.error("[claim] authorization payout failed:", e);
        claimed.push({
          id: auth.id,
          source: "authorization",
          amountUsd: auth.amountUsd,
          status: "failed",
        });
        continue;
      }
    } else {
      txHash = `offchain-claim-${auth.id.slice(0, 8)}`;
    }

    await markAuthorizationSettled(auth.id, {
      settlementId: auth.settlementId ?? undefined,
      walletAddress: parsed.data.walletAddress,
    });

    if (auth.settlementId) {
      await prisma.paymentEvent
        .create({
          data: {
            settlementId: auth.settlementId,
            type: "AuthorizationClaimed",
            payloadJson: JSON.stringify({
              authorizationId: auth.id,
              connectorId: auth.connectorId,
              githubUsername,
              amountUsd: auth.amountUsd,
              txHash,
              memo: memoText,
            }),
          },
        })
        .catch(() => {
          /* non-fatal */
        });
    }

    claimed.push({
      id: auth.id,
      source: "authorization",
      amountUsd: auth.amountUsd,
      txHash,
      status,
    });
  }

  for (const reward of rewardsToClaim) {
    const intent = {
      id: `claim:${reward.id}`,
      wallet: parsed.data.walletAddress,
      login: githubUsername,
      weight: reward.weight,
      amountUsd: reward.amountUsd,
      rank: 0,
      status: "processing" as const,
    };

    const memoText = buildContributorMemo({
      missionId: reward.missionId,
      repo: reward.repo ?? undefined,
      intent,
      proofHash: reward.proofHash,
      batchNumber: 0,
    });

    let txHash: string | undefined;
    let status = "settled";

    if (isLiveArcEnabled()) {
      try {
        const result = await sendUsdcWithMemo({
          recipient: parsed.data.walletAddress as `0x${string}`,
          amountUsd: reward.amountUsd,
          memo: memoText,
          memoRef: `claim:${reward.id}:${githubUsername}`,
        });
        txHash = result.txHash;
      } catch (e) {
        console.error("[claim] legacy reward payout failed:", e);
        claimed.push({
          id: reward.id,
          source: "legacy_reward",
          amountUsd: reward.amountUsd,
          status: "failed",
        });
        continue;
      }
    } else {
      txHash = `offchain-claim-${reward.id.slice(0, 8)}`;
    }

    await markRewardSettled(reward.id, {
      walletAddress: parsed.data.walletAddress,
      txHash,
    });

    if (reward.settlementId) {
      await prisma.paymentEvent
        .create({
          data: {
            settlementId: reward.settlementId,
            type: "RewardClaimed",
            payloadJson: JSON.stringify({
              rewardId: reward.id,
              githubUsername,
              amountUsd: reward.amountUsd,
              txHash,
              memo: memoText,
            }),
          },
        })
        .catch(() => {
          /* non-fatal */
        });
    }

    claimed.push({
      id: reward.id,
      source: "legacy_reward",
      amountUsd: reward.amountUsd,
      txHash,
      status,
    });
  }

  const totalUsd = claimed
    .filter((c) => c.status === "settled")
    .reduce((s, c) => s + c.amountUsd, 0);

  const payoutCurrency = await getContributorPayoutPreference(githubUsername);
  const fxHint = buildFxSwapHint(totalUsd, payoutCurrency);

  return NextResponse.json({
    ok: true,
    githubUsername,
    walletAddress: parsed.data.walletAddress,
    claimed,
    totalUsd: Math.round(totalUsd * 100) / 100,
    payoutCurrency,
    fxHint,
  });
}
