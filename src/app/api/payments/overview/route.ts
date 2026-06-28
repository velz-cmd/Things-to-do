import { NextResponse } from "next/server";
import {
  getUserAuthorizationSummary,
  getAuthorizationsForPayee,
} from "@/lib/authorization/ledger";
import { requireSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { extractGithubIdentity } from "@/lib/identity/contributors";
import { prisma } from "@/lib/db";

const EMPTY_LEDGER = {
  authorizedUsd: 0,
  pendingFundingUsd: 0,
  claimableUsd: 0,
  settledUsd: 0,
  count: 0,
};

/** Per-member financial snapshot — never mixes other users' ledger rows. */
export async function GET() {
  const session = await requireSessionUser();
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  const profile = await ensureProfileForUser(session.user);
  const { login } = extractGithubIdentity(session.user);
  const githubUsername = login ?? profile.githubUsername;

  const programs = await prisma.resolveProgram.findMany({
    where: { userId: profile.id },
    select: { missionId: true },
  });
  const missionIds = programs
    .map((p) => p.missionId)
    .filter((id): id is string => Boolean(id));

  const settlementWhere =
    missionIds.length > 0 ? { missionId: { in: missionIds } } : null;

  const [ledger, userAuthorizations, settlements] = await Promise.all([
    getUserAuthorizationSummary({
      userId: profile.id,
      githubUsername,
    }).catch(() => EMPTY_LEDGER),
    githubUsername
      ? getAuthorizationsForPayee("github", githubUsername, [
          "claimable",
          "authorized",
          "settled",
          "pending_funding",
        ]).catch(() => [])
      : Promise.resolve([]),
    settlementWhere
      ? prisma.missionSettlement
          .findMany({
            where: settlementWhere,
            orderBy: { createdAt: "desc" },
            take: 15,
            select: {
              id: true,
              missionId: true,
              repo: true,
              status: true,
              treasuryAmount: true,
              createdAt: true,
              escrowTxHash: true,
            },
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    ledger,
    recentAuthorizations: userAuthorizations.slice(0, 20).map((a) => ({
      id: a.id,
      connectorId: a.connectorId,
      missionId: a.missionId,
      payeeKey: a.payeeKey,
      amountUsd: a.amountUsd,
      status: a.status,
      contextLabel: a.contextLabel,
      updatedAt: a.updatedAt,
    })),
    settlements,
    updatedAt: new Date().toISOString(),
  });
}
