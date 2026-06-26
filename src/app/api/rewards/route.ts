import { NextResponse } from "next/server";
import { requireSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import {
  getContributorRewardSummary,
  getContributorAuthorizations,
  getPendingRewardsForGithub,
} from "@/lib/identity/pending-rewards";
import { extractGithubIdentity } from "@/lib/identity/contributors";

/** Contributor reward dashboard — Authorization Ledger + legacy pending rewards */
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
      message: "Sign in with GitHub to view your authorizations",
      summary: { claimableUsd: 0, pendingUsd: 0, settledUsd: 0, verifiedUsd: 0, rewardCount: 0 },
      rewards: [],
      authorizations: [],
    });
  }

  const [summary, rewards, authorizations] = await Promise.all([
    getContributorRewardSummary(profileLogin),
    getPendingRewardsForGithub(profileLogin),
    getContributorAuthorizations(profileLogin).catch(() => []),
  ]);

  return NextResponse.json({
    githubLinked: true,
    githubUsername: profileLogin,
    summary,
    rewards,
    authorizations: authorizations.map((a) => ({
      id: a.id,
      connectorId: a.connectorId,
      missionId: a.missionId,
      amountUsd: a.amountUsd,
      status: a.status,
      contextLabel: a.contextLabel,
      createdAt: a.createdAt,
      fulfilledAt: a.fulfilledAt,
      settledAt: a.settledAt,
    })),
  });
}
