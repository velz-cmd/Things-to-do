import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { isAddress } from "viem";
import { requireReadyUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import {
  recordConfirmedDirectSupport,
  type ConfirmedDirectSupport,
} from "@/lib/discover/direct-support";
import { sendIdentityUsdc } from "@/lib/wallet/send-identity-usdc";
import { verifyArcTransferFromWallet } from "@/lib/wallet/verify-crypto-deposit";
import {
  directSupportActionKey,
  directSupportRequestSchema,
} from "@/lib/discover/direct-support-contract";
import { resolvePayableVerifiedWork } from "@/lib/discover/verified-work-payment";
import {
  computeObligationId,
  computePolicyFingerprint,
  periodForMechanism,
} from "@/lib/discover/marketplace/economic-state";

export const maxDuration = 120;

async function verifiedRecipient(recipientUserId: string) {
  const payout = await prisma.payoutDestination.findFirst({
    where: {
      userId: recipientUserId,
      identityId: null,
      status: "verified",
      verifiedAt: { not: null },
      network: "ARC-TESTNET",
      asset: "USDC",
    },
    orderBy: { verifiedAt: "desc" },
    select: { address: true, network: true, asset: true, verifiedAt: true },
  });
  if (!payout) return null;
  const user = await prisma.user.findUnique({
    where: { id: recipientUserId },
    select: { displayName: true, githubUsername: true },
  });
  return {
    ...payout,
    label: user?.displayName ?? user?.githubUsername ?? "Verified recipient",
  };
}

function replayOutput(value: Prisma.JsonValue | null): ConfirmedDirectSupport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.receiptId !== "string" ||
    typeof row.receiptUrl !== "string" ||
    typeof row.explorerUrl !== "string" ||
    typeof row.txHash !== "string" ||
    typeof row.amountUsd !== "number" ||
    typeof row.destinationAddress !== "string"
  ) return null;
  return {
    ...(row as unknown as ConfirmedDirectSupport),
    purpose: row.purpose === "work_reward" ? "work_reward" : "direct_support",
  };
}

type PendingDirectSupport = {
  recipientUserId: string;
  amountUsd: number;
  fundingSource: "app" | "external";
  destinationAddress: string;
  txHash?: string;
  senderAddress?: string;
  purpose: "direct_support" | "work_reward";
  workSubjectId?: string;
};

function pendingInput(value: Prisma.JsonValue | null): PendingDirectSupport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.recipientUserId !== "string" ||
    typeof row.amountUsd !== "number" ||
    (row.fundingSource !== "app" && row.fundingSource !== "external") ||
    typeof row.destinationAddress !== "string"
  ) return null;
  return {
    recipientUserId: row.recipientUserId,
    amountUsd: row.amountUsd,
    fundingSource: row.fundingSource,
    destinationAddress: row.destinationAddress,
    txHash: typeof row.txHash === "string" ? row.txHash : undefined,
    senderAddress: typeof row.senderAddress === "string" ? row.senderAddress : undefined,
    purpose: row.purpose === "work_reward" ? "work_reward" : "direct_support",
    workSubjectId: typeof row.workSubjectId === "string" ? row.workSubjectId : undefined,
  };
}

export async function GET(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) return NextResponse.json({ error: ready.error }, { status: ready.status });
  const recipientUserId = new URL(req.url).searchParams.get("recipientUserId")?.trim();
  if (!recipientUserId || recipientUserId === ready.user.id) {
    return NextResponse.json({ error: "Choose another verified recipient." }, { status: 400 });
  }
  const payout = await verifiedRecipient(recipientUserId);
  if (!payout) {
    return NextResponse.json({ error: "This recipient has no verified payout destination." }, { status: 409 });
  }
  return NextResponse.json({
    destinationAddress: payout.address,
    network: payout.network,
    asset: payout.asset,
    recipientLabel: payout.label,
    verifiedAt: payout.verifiedAt?.toISOString() ?? null,
  });
}

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }
  const parsed = directSupportRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid send request" },
      { status: 400 },
    );
  }
  if (parsed.data.recipientUserId === ready.user.id) {
    return NextResponse.json({ error: "Choose another verified recipient." }, { status: 400 });
  }

  const work = parsed.data.purpose === "work_reward" && parsed.data.recipientUserId
    ? await resolvePayableVerifiedWork(parsed.data.workSubjectId!, parsed.data.recipientUserId)
    : null;
  if (parsed.data.purpose === "work_reward" && !work) {
    return NextResponse.json({
      error: "This work reward is not backed by a current persisted GitHub record attributed to the selected recipient.",
      code: "verified_work_required",
    }, { status: 409 });
  }

  // Phase 5 Release Slice 14: real obligation identity, computed
  // server-side and persisted additively into the existing JSON payloads
  // (ActionRun.input / Receipt.payload) - no schema migration required.
  // Only meaningful for a work_reward, which has a real canonical subject
  // (work.subjectId) to be an identity FOR; plain direct_support has none,
  // matching coverage-loader.ts's own existing scope. direct_support has
  // no persisted-policy concept (an individual's own voluntary choice), so
  // its fingerprint uses a stable constant subjectId rather than inventing
  // a rule that does not exist.
  const obligationId = work
    ? computeObligationId({
        mechanism: "direct_support",
        canonicalSubjectId: work.subjectId,
        purpose: work.title,
        period: periodForMechanism("direct_support") ?? { kind: "one_time" },
        beneficiaryId: parsed.data.recipientUserId!,
        policyFingerprint: computePolicyFingerprint({
          mechanism: "direct_support",
          eligibleClasses: [],
          amountRule: null,
          subjectId: "direct_support",
        }),
      })
    : undefined;

  // Phase 5 Release Slice 12: server-side stale-state revalidation. The
  // idempotency-key dedup below only catches a retry of THIS SAME
  // submission - it never checks whether a DIFFERENT submission (a second
  // tab, a second user, a retried request with a fresh idempotency key)
  // already confirmed or has a real transfer in flight for this exact work
  // reward. Reuses the already-built, already-tested Slice 8 coverage
  // loader rather than duplicating its query - the same authoritative
  // confirmed/pending contract, checked here before any new ActionRun is
  // created. This closes the double-payment race the canonical action
  // resolver's Release Slice 11 parity matrix proved the UI alone cannot
  // prevent (a stale client can always render a fund button before this
  // check runs); it is not a fully atomic guarantee absent a DB-level
  // uniqueness constraint on the work subject id, which is a schema change
  // out of scope for this session - documented here rather than silently
  // assumed solved.
  //
  // Release Slice 13: fail closed, never fail open. If the coverage lookup
  // itself could not complete (a real DB error), the loader now says so
  // explicitly (SourceAvailability) instead of silently returning an empty
  // result indistinguishable from "verified: genuinely no prior payment."
  // Trusting that silence here would defeat the entire stale-state guard -
  // an attacker (or just bad luck) could send during a DB hiccup and this
  // endpoint would proceed as if it had confirmed no coverage exists. The
  // user does not lose the ability to pay permanently; they get a safe,
  // retryable "try again shortly" response instead of either a false
  // rejection or a false green light.
  if (work) {
    const { loadCoverageBySourceId } = await import("@/lib/discover/marketplace/coverage-loader");
    const result = await loadCoverageBySourceId([work.subjectId]);
    if (result.confirmedAvailability === "unavailable" || result.pendingAvailability === "unavailable") {
      return NextResponse.json({
        error: "RESOLVE could not verify whether this work reward has already been paid. Please try again shortly.",
        code: "coverage_verification_unavailable",
        retryable: true,
      }, { status: 503 });
    }
    const coverage = result.recordsBySourceId.get(work.subjectId) ?? [];
    const alreadyConfirmed = coverage.some((record) => record.status !== "pending" && record.status !== "failed");
    const alreadyPending = coverage.some((record) => record.status === "pending");
    if (alreadyConfirmed) {
      return NextResponse.json({
        error: "This work reward has already been paid.",
        code: "work_reward_already_settled",
      }, { status: 409 });
    }
    if (alreadyPending) {
      return NextResponse.json({
        error: "A payment for this work reward is already in progress.",
        code: "work_reward_settlement_in_progress",
      }, { status: 409 });
    }
  }

  const actionKey = directSupportActionKey(
    ready.user.id,
    parsed.data.idempotencyKey,
    parsed.data.purpose,
  );
  const existing = await prisma.actionRun.findUnique({ where: { idempotencyKey: actionKey } });
  let resumable: PendingDirectSupport | null = null;
  if (existing) {
    const replay = replayOutput(existing.output);
    if (existing.userId !== ready.user.id) {
      return NextResponse.json({ error: "This operation belongs to another account." }, { status: 403 });
    }
    if (existing.state === "completed" && replay) {
      return NextResponse.json({ ok: true, status: "confirmed", replayed: true, ...replay });
    }
    const stored = pendingInput(existing.input);
    const sameOperation = Boolean(
      stored &&
      stored.recipientUserId === parsed.data.recipientUserId &&
      stored.amountUsd === parsed.data.amountUsd &&
      stored.fundingSource === parsed.data.fundingSource &&
      stored.purpose === parsed.data.purpose &&
      stored.workSubjectId === parsed.data.workSubjectId,
    );
    const resumableSender = stored?.senderAddress ?? (
      stored?.fundingSource === "external"
        ? ready.profile.scanWalletAddress?.trim() || undefined
        : ready.profile.walletAddress?.trim() || undefined
    );
    if (existing.state === "pending_external" && sameOperation && stored?.txHash && resumableSender) {
      resumable = { ...stored, senderAddress: resumableSender };
    } else {
      return NextResponse.json({
        error: existing.errorMessage ?? "This payment is already being processed.",
        code: existing.state === "rejected" ? existing.errorCode : "operation_in_progress",
        actionRunId: existing.id,
        retryable: existing.state === "pending_external" && Boolean(stored?.txHash),
      }, { status: existing.state === "rejected" ? 409 : 202 });
    }
  }

  let destinationAddress = parsed.data.destinationAddress;
  let recipientLabel = "Arc recipient";
  if (parsed.data.recipientUserId) {
    const payout = await verifiedRecipient(parsed.data.recipientUserId);
    if (!payout) {
      return NextResponse.json({ error: "This recipient has no verified payout destination." }, { status: 409 });
    }
    destinationAddress = payout.address;
    recipientLabel = payout.label;
  }
  if (!destinationAddress || !isAddress(destinationAddress)) {
    return NextResponse.json({ error: "Invalid send request" }, { status: 400 });
  }
  if (!parsed.data.recipientUserId) {
    if (parsed.data.fundingSource !== "app") {
      return NextResponse.json({
        error: "Connected-wallet sends require a verified RESOLVE recipient.",
      }, { status: 400 });
    }
    try {
      const result = await sendIdentityUsdc({
        user: ready.profile,
        destinationAddress,
        amountUsd: parsed.data.amountUsd,
        idempotencyKey: parsed.data.idempotencyKey,
      });
      return NextResponse.json({
        ok: true,
        ...result,
        message: `$${result.amountUsd.toFixed(2)} USDC sent on Arc`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send failed";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  let actionRun = existing;
  if (!actionRun) try {
    actionRun = await prisma.actionRun.create({
      data: {
        userId: ready.user.id,
        actionId: parsed.data.purpose === "work_reward" ? "discover.fund_verified_work" : "capital.send_usdc",
        aggregateType: parsed.data.purpose === "work_reward" ? "VerifiedWork" : "DirectSupport",
        aggregateId: work?.subjectId ?? parsed.data.recipientUserId,
        idempotencyKey: actionKey,
        state: "submitting",
        recommendationReason: parsed.data.purpose === "work_reward"
          ? "The user explicitly confirmed a voluntary reward for persisted GitHub work attributed to a recipient with a verified Arc payout destination."
          : "The user explicitly confirmed direct support for a recipient with a verified Arc payout destination.",
        input: {
          recipientUserId: parsed.data.recipientUserId,
          amountUsd: parsed.data.amountUsd,
          fundingSource: parsed.data.fundingSource,
          destinationAddress,
          txHash: parsed.data.txHash,
          purpose: parsed.data.purpose,
          workSubjectId: work?.subjectId,
          workTitle: work?.title,
          obligationId,
          repository: work?.repository,
          sourceUrl: work?.sourceUrl,
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.actionRun.findUnique({ where: { idempotencyKey: actionKey } });
      return NextResponse.json({
        error: "This payment is already being processed.",
        code: "operation_in_progress",
        actionRunId: raced?.id,
      }, { status: 202 });
    }
    throw error;
  }

  if (!actionRun) {
    return NextResponse.json({ error: "The direct-support operation could not be created." }, { status: 500 });
  }

  let submittedTxHash: string | undefined = resumable?.txHash;
  let submittedSenderAddress: string | undefined = resumable?.senderAddress;
  try {
    let txHash: string;
    let senderAddress: string;
    if (resumable?.txHash && resumable.senderAddress) {
      txHash = resumable.txHash;
      senderAddress = resumable.senderAddress;
      destinationAddress = resumable.destinationAddress;
      const verified = await verifyArcTransferFromWallet({
        txHash: txHash as `0x${string}`,
        expectedUsd: parsed.data.amountUsd,
        depositAddress: destinationAddress,
        fromWallet: senderAddress,
        destinationLabel: recipientLabel,
      });
      if (!verified.ok) throw new Error(verified.error);
    } else if (parsed.data.fundingSource === "external") {
      senderAddress = ready.profile.scanWalletAddress?.trim() ?? "";
      submittedTxHash = parsed.data.txHash;
      submittedSenderAddress = senderAddress || undefined;
      if (!senderAddress || !isAddress(senderAddress)) {
        throw new Error("Reconnect the wallet linked to this account before recording support.");
      }
      const verified = await verifyArcTransferFromWallet({
        txHash: parsed.data.txHash as `0x${string}`,
        expectedUsd: parsed.data.amountUsd,
        depositAddress: destinationAddress,
        fromWallet: senderAddress,
        destinationLabel: recipientLabel,
      });
      if (!verified.ok) throw new Error(verified.error);
      txHash = parsed.data.txHash!;
    } else {
      if (!ready.profile.walletAddress || !isAddress(ready.profile.walletAddress)) {
        throw new Error("No verified RESOLVE wallet is available for this account.");
      }
      senderAddress = ready.profile.walletAddress;
      const result = await sendIdentityUsdc({
        user: ready.profile,
        destinationAddress,
        amountUsd: parsed.data.amountUsd,
        idempotencyKey: parsed.data.idempotencyKey,
      });
      txHash = result.txHash;
    }
    submittedTxHash = txHash;
    submittedSenderAddress = senderAddress;
    await prisma.actionRun.update({
      where: { id: actionRun.id },
      data: {
        state: "pending_external",
        input: {
          recipientUserId: parsed.data.recipientUserId,
          amountUsd: parsed.data.amountUsd,
          fundingSource: parsed.data.fundingSource,
          destinationAddress,
          txHash,
          senderAddress,
          purpose: parsed.data.purpose,
          workSubjectId: work?.subjectId,
          workTitle: work?.title,
          obligationId,
          repository: work?.repository,
          sourceUrl: work?.sourceUrl,
        },
        errorCode: null,
        errorMessage: null,
      },
    });

    const result = await recordConfirmedDirectSupport({
      actionRunId: actionRun.id,
      idempotencyKey: parsed.data.idempotencyKey,
      senderUserId: ready.user.id,
      senderAddress,
      recipientUserId: parsed.data.recipientUserId,
      recipientLabel,
      destinationAddress,
      amountUsd: parsed.data.amountUsd,
      txHash,
      provider: parsed.data.fundingSource === "external"
        ? "connected_wallet_arc_direct_support"
        : "circle_arc_direct_support",
      purpose: parsed.data.purpose,
      work: work
        ? {
            subjectId: work.subjectId,
            title: work.title,
            repository: work.repository,
            sourceUrl: work.sourceUrl,
            evidenceIds: work.evidenceIds,
          }
        : undefined,
      obligationId,
    });
    return NextResponse.json({ ok: true, status: "confirmed", replayed: false, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";
    const transferWasSubmitted = Boolean(submittedTxHash);
    await prisma.actionRun.update({
      where: { id: actionRun.id },
      data: {
        state: transferWasSubmitted ? "pending_external" : "rejected",
        errorCode: transferWasSubmitted
          ? `${parsed.data.purpose}_receipt_pending`
          : `${parsed.data.purpose}_failed`,
        errorMessage: message.slice(0, 500),
        completedAt: transferWasSubmitted ? null : new Date(),
        ...(transferWasSubmitted
          ? {
              input: {
                recipientUserId: parsed.data.recipientUserId,
                amountUsd: parsed.data.amountUsd,
                fundingSource: parsed.data.fundingSource,
                destinationAddress,
                txHash: submittedTxHash,
                senderAddress: submittedSenderAddress,
                purpose: parsed.data.purpose,
                workSubjectId: work?.subjectId,
                workTitle: work?.title,
                obligationId,
                repository: work?.repository,
                sourceUrl: work?.sourceUrl,
              },
            }
          : {}),
      },
    }).catch(() => null);
    return NextResponse.json({
      error: transferWasSubmitted
        ? "The Arc transfer is preserved, but its RESOLVE receipt still needs reconciliation. Retry this action without sending again."
        : message,
      actionRunId: actionRun.id,
      txHash: submittedTxHash,
      retryable: transferWasSubmitted,
    }, { status: transferWasSubmitted ? 202 : 400 });
  }
}
