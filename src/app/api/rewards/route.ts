import { NextResponse } from "next/server";
import { requireSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import {
  getContributorRewardSummary,
  getPendingRewardsForGithub,
} from "@/lib/identity/pending-rewards";
import { extractGithubIdentity } from "@/lib/identity/contributors";

/** Contributor reward dashboard — pending, claimable, settled */
export async function GET() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  await ensureProfileForUser(session.user);
  const { login } = extractGithubIdentity(session.user);

  const profileLogin =
    login ??
    (await import("@/lib/db").then(({ prisma }) =>
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { githubUsername: true },
      }),
    ))?.githubUsername;

  if (!profileLogin) {
    return NextResponse.json({
      githubLinked: false,
      message: "Sign in with GitHub to view your rewards",
      summary: { claimableUsd: 0, pendingUsd: 0, settledUsd: 0, verifiedUsd: 0, rewardCount: 0 },
      rewards: [],
    });
  }

  const [summary, rewards] = await Promise.all([
    getContributorRewardSummary(profileLogin),
    getPendingRewardsForGithub(profileLogin),
  ]);

  return NextResponse.json({
    githubLinked: true,
    githubUsername: profileLogin,
    summary,
    rewards,
  });
}
