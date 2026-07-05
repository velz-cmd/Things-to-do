import { prisma } from "@/lib/db";
import { createClaimToken, claimUrlForToken } from "@/lib/claim/tokens";
import { sendCreatorClaimEmail } from "@/lib/email/claim-email";
import { getAuthEmailDeliveryStatus } from "@/lib/email/deliver";
import { communityLabelForMission } from "@/lib/earn/community-label";
import {
  aggregateNotifyCandidate,
  evaluateNotifyCandidate,
} from "@/lib/earn/notify-policy";

export type EarnNotifyResult = {
  payeeKeyType: string;
  payeeKey: string;
  amountUsd: number;
  emailSent: boolean;
  claimUrl: string;
  channel: "email" | "log";
  reason?: string;
  urgency?: number;
  skipped?: boolean;
};

type AuthorizationRow = {
  id: string;
  amountUsd: number;
  confidence: number;
  fulfilledAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  contextLabel: string | null;
};

async function resolvePayeeEmail(
  payeeKeyType: string,
  payeeKey: string,
): Promise<string | null> {
  const normalizedType =
    payeeKeyType === "github_user" ? "github_username" : payeeKeyType;

  if (normalizedType === "github_username") {
    const user = await prisma.user.findFirst({
      where: { githubUsername: { equals: payeeKey, mode: "insensitive" } },
      select: { email: true },
    });
    if (user?.email) return user.email;
  }

  if (payeeKeyType === "musicbrainz_artist") {
    const byMbid = await prisma.contributorRegistry.findFirst({
      where: { musicbrainzId: payeeKey },
      select: { platformId: true },
    });
    if (byMbid?.platformId?.includes("@")) return byMbid.platformId;
  }

  const contributor = await prisma.contributorRegistry.findFirst({
    where:
      normalizedType === "github_username"
        ? { githubUsername: { equals: payeeKey, mode: "insensitive" } }
        : normalizedType === "musicbrainz_artist"
          ? { musicbrainzId: payeeKey }
          : {
              OR: [
                { exifArtist: { equals: payeeKey, mode: "insensitive" } },
                { creatorName: { equals: payeeKey, mode: "insensitive" } },
                { musicbrainzId: payeeKey },
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
  if (payeeKeyType === "github_username" || payeeKeyType === "github_user") {
    return `@${payeeKey}`;
  }
  if (payeeKeyType === "listen_artist") return payeeKey;
  return payeeKey;
}

function claimableSinceFromRow(row: AuthorizationRow) {
  return row.fulfilledAt ?? row.updatedAt ?? row.createdAt;
}

/** Notify a payee that earnings are claimable — email when policy passes, always log claim URL. */
export async function notifyEarnAvailable(input: {
  payeeKeyType: string;
  payeeKey: string;
  authorizationIds: string[];
  amountUsd: number;
  missionId?: string;
  contextLabel?: string;
  confidence?: number;
  claimableSince?: Date;
  authorizationRows?: AuthorizationRow[];
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
  const community =
    input.missionId ?
      await communityLabelForMission(input.missionId)
    : { communityName: input.contextLabel ?? "RESOLVE" };
  const communityName = community.communityName;

  const candidate =
    input.authorizationRows?.length
      ? aggregateNotifyCandidate(
          input.authorizationRows.map((row) => ({
            amountUsd: row.amountUsd,
            confidence: row.confidence,
            claimableSince: claimableSinceFromRow(row),
          })),
        )
      : {
          amountUsd: amount,
          confidence: input.confidence ?? 0.85,
          claimableSince: input.claimableSince ?? new Date(),
        };

  const policy = candidate
    ? evaluateNotifyCandidate(candidate)
    : { notify: false, urgency: 0, decay: 1, reason: "no_candidate" };

  const resolvedEmail = await resolvePayeeEmail(input.payeeKeyType, payeeKey);
  const devInbox = process.env.RESEND_CLAIM_TO?.trim();
  const to = resolvedEmail ?? devInbox ?? null;
  const emailReady = Boolean(getAuthEmailDeliveryStatus().primary);

  let emailSent = false;
  let channel: EarnNotifyResult["channel"] = "log";
  let reason: string | undefined = policy.reason;

  if (!policy.notify) {
    reason = reason ?? "notify_policy_skip";
    console.info(
      `[earn] skip notify ${input.payeeKeyType}:${payeeKey} $${amount} — ${reason} (urgency=${policy.urgency.toFixed(2)})`,
    );
  } else if (emailReady && to) {
    try {
      const sent = await sendCreatorClaimEmail({
        to,
        subject: `You've earned $${amount.toFixed(2)} from ${communityName}`,
        body: [
          `Hi ${label},`,
          "",
          `You've earned $${amount.toFixed(2)} from ${communityName}.`,
          `RESOLVE verified this from public attribution — you don't need a RESOLVE account yet.`,
          input.contextLabel ? `Source: ${input.contextLabel}` : "",
          "",
          "Claim your earnings (sign in or connect wallet, receive USDC on Arc).",
          "",
          "This link expires in 14 days.",
        ]
          .filter(Boolean)
          .join("\n"),
        claimUrl,
        taskId: input.missionId,
      });
      if (sent.ok) {
        emailSent = true;
        channel = "email";
        reason = undefined;
      } else {
        reason = sent.error ?? "email_failed";
        console.warn("[earn] email failed:", reason);
      }
    } catch (e) {
      reason = e instanceof Error ? e.message : "email_failed";
      console.warn("[earn] email failed:", reason);
    }
  } else if (!emailReady) {
    reason = "Email provider not configured (Brevo or Resend)";
  } else {
    reason = "no_email_for_payee";
  }

  console.info(
    `[earn] claimable $${amount} for ${input.payeeKeyType}:${payeeKey} → ${claimUrl}`,
  );

  const now = new Date();
  if (input.authorizationIds.length && (emailSent || !policy.notify)) {
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
    urgency: policy.urgency,
    skipped: !policy.notify,
  };
}

/** Group claimable authorizations by payee and send earn notifications. */
export async function notifyClaimableAuthorizationsForMission(missionId: string) {
  const rows = await prisma.paymentAuthorization.findMany({
    where: { missionId, status: "claimable", notifiedAt: null },
  });

  const groups = new Map<
    string,
    {
      payeeKeyType: string;
      payeeKey: string;
      ids: string[];
      rows: AuthorizationRow[];
      contextLabel?: string;
    }
  >();

  for (const row of rows) {
    const key = `${row.payeeKeyType}:${row.payeeKey}`;
    const existing = groups.get(key);
    const authRow: AuthorizationRow = {
      id: row.id,
      amountUsd: row.amountUsd,
      confidence: row.confidence,
      fulfilledAt: row.fulfilledAt,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
      contextLabel: row.contextLabel,
    };
    if (existing) {
      existing.ids.push(row.id);
      existing.rows.push(authRow);
      if (!existing.contextLabel && row.contextLabel) {
        existing.contextLabel = row.contextLabel;
      }
    } else {
      groups.set(key, {
        payeeKeyType: row.payeeKeyType,
        payeeKey: row.payeeKey,
        ids: [row.id],
        rows: [authRow],
        contextLabel: row.contextLabel ?? undefined,
      });
    }
  }

  const results: EarnNotifyResult[] = [];
  for (const g of groups.values()) {
    const amountUsd = g.rows.reduce((s, r) => s + r.amountUsd, 0);
    results.push(
      await notifyEarnAvailable({
        payeeKeyType: g.payeeKeyType,
        payeeKey: g.payeeKey,
        authorizationIds: g.ids,
        amountUsd,
        missionId,
        contextLabel: g.contextLabel,
        authorizationRows: g.rows,
      }),
    );
  }
  return results;
}

/** Scan all un-notified claimable rows (cron / passive channel). */
export async function notifyAllUnnotifiedClaimable() {
  const rows = await prisma.paymentAuthorization.findMany({
    where: { status: "claimable", notifiedAt: null },
    take: 500,
  });

  const byMission = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byMission.get(row.missionId) ?? [];
    list.push(row);
    byMission.set(row.missionId, list);
  }

  const results: EarnNotifyResult[] = [];
  for (const missionId of byMission.keys()) {
    results.push(...(await notifyClaimableAuthorizationsForMission(missionId)));
  }
  return results;
}
