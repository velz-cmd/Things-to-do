import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { getAuthorizationSummary, fulfillMissionAuthorizations } from "@/lib/authorization/ledger";
import { getProgram } from "@/lib/communities/programs";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";
import { runPaymentSettlement } from "@/lib/payment/orchestrator";
import { resolvePayee } from "@/lib/registry/resolvers";

export type DeployProgramResult = {
  ok: boolean;
  message: string;
  settlementId?: string;
  settledUsd?: number;
  claimableUsd?: number;
  payeeCount?: number;
  explorerUrls?: string[];
  error?: string;
};

/** Deploy program authorizations on Arc — batch settlement from ledger */
export async function deployProgramOnArc(
  userId: string,
  programId: string,
): Promise<DeployProgramResult> {
  const program = await getProgram(userId, programId);
  if (!program) {
    return { ok: false, message: "Program not found", error: "not_found" };
  }

  if (!program.missionId) {
    return { ok: false, message: "Program has no mission scope", error: "no_mission" };
  }

  const community = getCommunityBySlug(program.communitySlug);
  const summary = await getAuthorizationSummary({
    missionId: program.missionId,
    connectorId: program.rules.connectorId,
  });

  const authorized = summary.authorizations.filter(
    (a) => a.status === "authorized" || a.status === "pending_funding",
  );

  if (!authorized.length) {
    return {
      ok: false,
      message: "No authorized plays to settle — connect Navidrome and sync scrobbles first",
      error: "no_authorizations",
    };
  }

  const byPayee = new Map<
    string,
    { payeeKeyType: string; payeeKey: string; amountUsd: number; weight: number }
  >();

  for (const auth of authorized) {
    const key = `${auth.payeeKeyType}:${auth.payeeKey}`;
    const existing = byPayee.get(key);
    if (existing) {
      existing.amountUsd += auth.amountUsd;
    } else {
      byPayee.set(key, {
        payeeKeyType: auth.payeeKeyType,
        payeeKey: auth.payeeKey,
        amountUsd: auth.amountUsd,
        weight: auth.amountUsd,
      });
    }
  }

  const contributors: Array<{
    wallet: string;
    login?: string;
    weight: number;
    amount: string;
    rank: number;
  }> = [];
  const claimablePayees: Array<{ payeeKeyType: string; payeeKey: string }> = [];
  let pendingClaimUsd = 0;
  let rank = 1;

  for (const payee of byPayee.values()) {
    const resolved = await resolvePayee({
      platform: "navidrome",
      payload: { exifArtist: payee.payeeKey, artist: payee.payeeKey },
    });

    if (resolved?.wallet) {
      contributors.push({
        wallet: resolved.wallet,
        login: payee.payeeKey,
        weight: payee.weight || payee.amountUsd,
        amount: payee.amountUsd.toFixed(6),
        rank: rank++,
      });
    } else {
      claimablePayees.push({
        payeeKeyType: payee.payeeKeyType,
        payeeKey: payee.payeeKey,
      });
      pendingClaimUsd += payee.amountUsd;
    }
  }

  const settledTotal = contributors.reduce((s, c) => s + Number(c.amount), 0);
  const treasuryAmount = Math.min(
    program.budgetUsd > 0 ? program.budgetUsd : settledTotal + pendingClaimUsd,
    settledTotal + pendingClaimUsd,
  );

  if (treasuryAmount <= 0) {
    return { ok: false, message: "Nothing to deploy", error: "zero_amount" };
  }

  const proofHash = createHash("sha256")
    .update(`${program.id}:${program.missionId}:${Date.now()}`)
    .digest("hex");

  if (contributors.length > 0) {
    const result = await runPaymentSettlement({
      missionId: program.missionId,
      repo: community?.slug,
      treasuryAmount,
      confidence: 0.9,
      proofHash,
      contributors,
      pendingClaimUsd: pendingClaimUsd > 0 ? pendingClaimUsd : undefined,
      agentsRun: ["attribution", "settlement"],
    });

    if ("error" in result) {
      return { ok: false, message: result.error, error: result.code ?? "settlement_failed" };
    }

    await fulfillMissionAuthorizations({
      missionId: program.missionId,
      settlementId: result.settlementId,
      settledPayeeKeys: contributors.map((c) => ({
        payeeKeyType: "listen_artist",
        payeeKey: c.login ?? c.wallet,
        walletAddress: c.wallet,
      })),
      claimablePayeeKeys: claimablePayees,
    });

    const install = await prisma.resolveCommunityInstall.findFirst({
      where: { userId, communitySlug: program.communitySlug },
    });

    await prisma.resolveProgram.update({
      where: { id: programId },
      data: {
        status: "deployed",
        lastDeployAt: new Date(),
        lastSettlementId: result.settlementId,
      },
    });

    await recordTimelineEvent({
      userId,
      ecosystemId: install?.ecosystemId ?? undefined,
      eventType: "program_deployed",
      title: `Deployed ${program.name} on Arc`,
      detail: `$${settledTotal.toFixed(2)} settled · ${contributors.length} payees · batch #${result.proof?.batchNumber ?? "—"}`,
      severity: "info",
      metadata: {
        programId,
        settlementId: result.settlementId,
        communitySlug: program.communitySlug,
      },
    });

    return {
      ok: true,
      message: `Deployed on Arc — $${settledTotal.toFixed(2)} USDC to ${contributors.length} artists`,
      settlementId: result.settlementId,
      settledUsd: settledTotal,
      claimableUsd: pendingClaimUsd,
      payeeCount: byPayee.size,
      explorerUrls: result.explorerUrls,
    };
  }

  await fulfillMissionAuthorizations({
    missionId: program.missionId,
    settlementId: `claimable:${program.id}`,
    settledPayeeKeys: [],
    claimablePayeeKeys: claimablePayees,
  });

  await prisma.resolveProgram.update({
    where: { id: programId },
    data: { status: "active", lastDeployAt: new Date() },
  });

  return {
    ok: true,
    message: `$${pendingClaimUsd.toFixed(2)} marked claimable — artists can link wallets to receive`,
    claimableUsd: pendingClaimUsd,
    payeeCount: claimablePayees.length,
  };
}
