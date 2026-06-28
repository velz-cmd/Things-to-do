import { NextResponse } from "next/server";
import { requireSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { extractGithubIdentity } from "@/lib/identity/contributors";
import { getClaimableItemsForGithub } from "@/lib/identity/pending-rewards";
import { getProfileEarningsSummary } from "@/lib/earn/summary";
import { createClaimToken, claimUrlForToken } from "@/lib/claim/tokens";

/** Signed-in claim preview — default entry when notification lands on /claim without token. */
export async function GET() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const profile = await ensureProfileForUser(session.user);
  const earnings = await getProfileEarningsSummary({ profile, authUser: session.user });
  const { login } = extractGithubIdentity(session.user);
  const githubUsername =
    login?.toLowerCase() ?? profile.githubUsername?.toLowerCase() ?? null;

  if (!githubUsername && earnings.claimableUsd <= 0) {
    return NextResponse.json({
      ok: true,
      signedIn: true,
      githubLinked: false,
      claimableUsd: earnings.claimableUsd,
      amountUsd: earnings.claimableUsd,
      status: earnings.claimableUsd > 0 ? "claimable" : "pending",
      payeeLabel: profile.displayName ?? session.user.email ?? "your account",
      requiresGithub: true,
      identityMatch: false,
      signedInGithub: null,
      authorizations: [],
      legacyRewardIds: [],
      claimUrl: null,
    });
  }

  let authorizations: {
    id: string;
    connectorId: string;
    missionId: string;
    amountUsd: number;
    contextLabel: string | null;
  }[] = [];
  let legacyRewardIds: string[] = [];

  if (githubUsername) {
    const items = await getClaimableItemsForGithub(githubUsername);
    authorizations = items.authorizations.map((a) => ({
      id: a.id,
      connectorId: a.connectorId,
      missionId: a.missionId,
      amountUsd: a.amountUsd,
      contextLabel: a.contextLabel,
    }));
    legacyRewardIds = items.legacyRewards.map((r) => r.id);
  }

  const claimableUsd = earnings.claimableUsd;
  const primaryIdentity = earnings.identities.find((i) => i.claimableUsd > 0) ?? earnings.identities[0];

  const token =
    primaryIdentity && claimableUsd > 0
      ? createClaimToken({
          payeeKeyType: primaryIdentity.payeeKeyType,
          payeeKey: primaryIdentity.payeeKey,
          authorizationIds: authorizations.map((a) => a.id),
          amountUsd: claimableUsd,
        })
      : null;

  return NextResponse.json({
    ok: true,
    signedIn: true,
    githubLinked: Boolean(githubUsername),
    signedInGithub: githubUsername,
    identityMatch: true,
    requiresGithub: Boolean(githubUsername),
    payeeKeyType: primaryIdentity?.payeeKeyType ?? "github_username",
    payeeKey: primaryIdentity?.payeeKey ?? githubUsername,
    payeeLabel: primaryIdentity?.label ?? (githubUsername ? `@${githubUsername}` : "you"),
    amountUsd: claimableUsd,
    claimableUsd,
    claimableCount: authorizations.length + legacyRewardIds.length,
    status: claimableUsd > 0 ? "claimable" : earnings.settledUsd > 0 ? "settled" : "pending",
    authorizations,
    legacyRewardIds,
    claimUrl: token ? claimUrlForToken(token) : null,
    stalestClaimableAt: earnings.stalestClaimableAt,
    notifyUrgency: earnings.notifyUrgency,
  });
}
