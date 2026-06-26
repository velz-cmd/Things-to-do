import { prisma } from "@/lib/db";
import { createClaimToken, claimUrlForToken } from "@/lib/claim/tokens";
import { sendClaimEmail } from "@/lib/deputy/tools/resend";
import { getResendClient } from "@/lib/resend/client";

export type EarnNotifyResult = {
  payeeKeyType: string;
  payeeKey: string;
  amountUsd: number;
  emailSent: boolean;
  claimUrl: string;
  channel: "email" | "log";
  reason?: string;
};

async function resolvePayeeEmail(
  payeeKeyType: string,
  payeeKey: string,
): Promise<string | null> {
  if (payeeKeyType === "github_username") {
    const user = await prisma.user.findFirst({
      where: { githubUsername: { equals: payeeKey, mode: "insensitive" } },
      select: { email: true },
    });
    if (user?.email) return user.email;
  }

  const contributor = await prisma.contributorRegistry.findFirst({
    where:
      payeeKeyType === "github_username"
        ? { githubUsername: { equals: payeeKey, mode: "insensitive" } }
        : {
            OR: [
              { exifArtist: { equals: payeeKey, mode: "insensitive" } },
              { creatorName: { equals: payeeKey, mode: "insensitive" } },
            ],
          },
    select: { platformId: true },
  });

  if (contributor?.platformId?.includes("@")) {
    return contributor.platformId;
  }

  return null;
}

function payeeLabel(payeeKeyType: string, payeeKey: string) {
  if (payeeKeyType === "github_username") return `@${payeeKey}`;
  if (payeeKeyType === "listen_artist") return payeeKey;
  return payeeKey;
}

/** Notify a payee that earnings are claimable — email when possible, always log claim URL. */
export async function notifyEarnAvailable(input: {
  payeeKeyType: string;
  payeeKey: string;
  authorizationIds: string[];
  amountUsd: number;
  missionId?: string;
  contextLabel?: string;
}): Promise<EarnNotifyResult> {
  const payeeKey = input.payeeKey.toLowerCase();
  const token = createClaimToken({
    payeeKeyType: input.payeeKeyType,
    payeeKey,
    authorizationIds: input.authorizationIds,
    amountUsd: input.amountUsd,
  });
  const claimUrl = claimUrlForToken(token);
  const label = payeeLabel(input.payeeKeyType, payeeKey);
  const amount = Math.round(input.amountUsd * 100) / 100;

  const resolvedEmail = await resolvePayeeEmail(input.payeeKeyType, payeeKey);
  const devInbox = process.env.RESEND_CLAIM_TO?.trim();
  const to = resolvedEmail ?? devInbox ?? null;

  let emailSent = false;
  let channel: EarnNotifyResult["channel"] = "log";
  let reason: string | undefined;

  if (getResendClient() && to) {
    try {
      await sendClaimEmail({
        to,
        subject: `You've earned $${amount.toFixed(2)} on RESOLVE`,
        body: [
          `Hi ${label},`,
          "",
          `RESOLVE verified $${amount.toFixed(2)} in compensation for your contribution.`,
          input.contextLabel ? `Source: ${input.contextLabel}` : "",
          "",
          "Claim your earnings (sign in with GitHub, connect wallet, receive USDC):",
          claimUrl,
          "",
          "This link expires in 14 days.",
        ]
          .filter(Boolean)
          .join("\n"),
        taskId: input.missionId,
      });
      emailSent = true;
      channel = "email";
    } catch (e) {
      reason = e instanceof Error ? e.message : "email_failed";
      console.warn("[earn] email failed:", reason);
    }
  } else if (!getResendClient()) {
    reason = "RESEND_API_KEY not configured";
  } else {
    reason = "no_email_for_payee";
  }

  console.info(
    `[earn] claimable $${amount} for ${input.payeeKeyType}:${payeeKey} → ${claimUrl}`,
  );

  const now = new Date();
  if (input.authorizationIds.length) {
    await prisma.paymentAuthorization.updateMany({
      where: { id: { in: input.authorizationIds }, notifiedAt: null },
      data: { notifiedAt: now },
    });
  }

  if (input.payeeKeyType === "github_username") {
    await prisma.pendingReward.updateMany({
      where: {
        githubUsername: payeeKey,
        status: "claimable",
        notifiedAt: null,
        ...(input.missionId ? { missionId: input.missionId } : {}),
      },
      data: { notifiedAt: now },
    });
  }

  return {
    payeeKeyType: input.payeeKeyType,
    payeeKey,
    amountUsd: amount,
    emailSent,
    claimUrl,
    channel,
    reason,
  };
}

/** Group claimable authorizations by payee and send earn notifications. */
export async function notifyClaimableAuthorizationsForMission(missionId: string) {
  const rows = await prisma.paymentAuthorization.findMany({
    where: { missionId, status: "claimable", notifiedAt: null },
  });

  const groups = new Map<
    string,
    { payeeKeyType: string; payeeKey: string; ids: string[]; amountUsd: number; contextLabel?: string }
  >();

  for (const row of rows) {
    const key = `${row.payeeKeyType}:${row.payeeKey}`;
    const existing = groups.get(key);
    if (existing) {
      existing.ids.push(row.id);
      existing.amountUsd += row.amountUsd;
      if (!existing.contextLabel && row.contextLabel) {
        existing.contextLabel = row.contextLabel;
      }
    } else {
      groups.set(key, {
        payeeKeyType: row.payeeKeyType,
        payeeKey: row.payeeKey,
        ids: [row.id],
        amountUsd: row.amountUsd,
        contextLabel: row.contextLabel ?? undefined,
      });
    }
  }

  const results: EarnNotifyResult[] = [];
  for (const g of groups.values()) {
    results.push(
      await notifyEarnAvailable({
        payeeKeyType: g.payeeKeyType,
        payeeKey: g.payeeKey,
        authorizationIds: g.ids,
        amountUsd: g.amountUsd,
        missionId,
        contextLabel: g.contextLabel,
      }),
    );
  }
  return results;
}
