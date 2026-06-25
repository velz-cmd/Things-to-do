import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { linkWalletToGithub, extractGithubIdentity } from "@/lib/identity/contributors";
import {
  getPendingRewardsForGithub,
  markRewardSettled,
} from "@/lib/identity/pending-rewards";
import { sendUsdcWithMemo } from "@/lib/arc/memo";
import { buildContributorMemo } from "@/lib/payment/memo";
import { isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  walletAddress: z.string(),
  rewardIds: z.array(z.string()).optional(),
});

/** Contributor claims pending rewards — GitHub identity + wallet → Arc settlement */
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

  const rewards = await getPendingRewardsForGithub(githubUsername);
  const toClaim =
    parsed.data.rewardIds?.length ?
      rewards.filter((r) => parsed.data.rewardIds!.includes(r.id) && r.status === "claimable")
    : rewards.filter((r) => r.status === "claimable");

  if (!toClaim.length) {
    return NextResponse.json({ error: "No claimable rewards", claimed: [] });
  }

  const claimed: {
    rewardId: string;
    amountUsd: number;
    txHash?: string;
    status: string;
  }[] = [];

  for (const reward of toClaim) {
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
        console.error("[claim] payout failed:", e);
        status = "failed";
        claimed.push({ rewardId: reward.id, amountUsd: reward.amountUsd, status: "failed" });
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
      await prisma.paymentEvent.create({
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
      }).catch(() => {
        /* non-fatal */
      });
    }

    claimed.push({
      rewardId: reward.id,
      amountUsd: reward.amountUsd,
      txHash,
      status,
    });
  }

  const totalUsd = claimed
    .filter((c) => c.status === "settled")
    .reduce((s, c) => s + c.amountUsd, 0);

  return NextResponse.json({
    ok: true,
    githubUsername,
    walletAddress: parsed.data.walletAddress,
    claimed,
    totalUsd: Math.round(totalUsd * 100) / 100,
  });
}
