import { NextResponse } from "next/server";
import { verifyClaimToken } from "@/lib/claim/tokens";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { extractGithubIdentity } from "@/lib/identity/contributors";

/** Validate claim token and return earn preview (no auth required). */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const payload = verifyClaimToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired claim link" }, { status: 400 });
  }

  const authorizations = payload.authorizationIds.length
    ? await prisma.paymentAuthorization.findMany({
        where: { id: { in: payload.authorizationIds } },
      })
    : await prisma.paymentAuthorization.findMany({
        where: {
          payeeKeyType: payload.payeeKeyType,
          payeeKey: payload.payeeKey,
          status: { in: ["claimable", "claimed", "settled"] },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      });

  const claimable = authorizations.filter((a) => a.status === "claimable");
  const amountUsd =
    claimable.length > 0
      ? claimable.reduce((s, a) => s + a.amountUsd, 0)
      : payload.amountUsd;

  const sessionUser = await getSessionUser();
  let signedInGithub: string | null = null;
  let identityMatch = false;
  if (sessionUser) {
    const { login } = extractGithubIdentity(sessionUser);
    signedInGithub = login ?? null;
    if (payload.payeeKeyType === "github_username" && signedInGithub) {
      identityMatch = signedInGithub.toLowerCase() === payload.payeeKey;
    }
  }

  const legacyRewards =
    payload.payeeKeyType === "github_username"
      ? await prisma.pendingReward.findMany({
          where: {
            githubUsername: payload.payeeKey,
            status: "claimable",
          },
        })
      : [];

  const legacyUsd = legacyRewards.reduce((s, r) => s + r.amountUsd, 0);
  const totalClaimableUsd = Math.round((amountUsd + legacyUsd) * 100) / 100;

  return NextResponse.json({
    ok: true,
    payeeKeyType: payload.payeeKeyType,
    payeeKey: payload.payeeKey,
    payeeLabel:
      payload.payeeKeyType === "github_username"
        ? `@${payload.payeeKey}`
        : payload.payeeKey,
    amountUsd: totalClaimableUsd,
    claimableCount: claimable.length + legacyRewards.length,
    status:
      totalClaimableUsd > 0 ? "claimable"
      : authorizations.some((a) => a.status === "settled") ? "settled"
      : "pending",
    signedIn: Boolean(sessionUser),
    signedInGithub,
    identityMatch,
    requiresGithub: payload.payeeKeyType === "github_username",
    authorizations: claimable.map((a) => ({
      id: a.id,
      connectorId: a.connectorId,
      missionId: a.missionId,
      amountUsd: a.amountUsd,
      contextLabel: a.contextLabel,
    })),
    legacyRewardIds: legacyRewards.map((r) => r.id),
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  });
}
