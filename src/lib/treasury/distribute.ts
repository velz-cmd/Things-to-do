import { prisma } from "@/lib/db";
import { verifyProof } from "@/lib/deputy/proof-engine";
import { hashProofPayload } from "@/lib/deputy/state-machine";
import { sendBatchMemoPayouts, primaryTxFromPayouts } from "@/lib/arc/memo";
import { explorerTxUrl, isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { getArcReadiness } from "@/lib/treasury/arc-readiness";
import { resolvePayee } from "@/lib/registry/resolvers";
import type {
  DistributeRequest,
  DistributeResult,
  DistributionEventInput,
  ResolvedPayment,
} from "@/lib/gateway/types";

function categoryForType(type: string): string {
  if (type.includes("pr_merged") || type.includes("deliverable")) return "bounty";
  if (type.includes("scrobble") || type.includes("stream") || type.includes("shared_link")) {
    return "distribution";
  }
  if (type.includes("approved") || type.includes("milestone")) return "contributor";
  return "distribution";
}

function verifyEvent(input: {
  type: string;
  category: string;
  payload: Record<string, unknown>;
  amountUsd: number;
  sampled: boolean;
}): { verified: boolean; reason: string; confidence: number; proofHash: string } {
  const proofHash = hashProofPayload(input.payload);
  const result = verifyProof({
    type: input.type,
    source: "gateway",
    payload: input.payload,
    category: input.category,
    targetValueUsd: input.amountUsd,
  });

  let confidence = result.verified ? 92 : 35;
  if (input.sampled && input.payload.geminiConfidence) {
    confidence = Number(input.payload.geminiConfidence);
  }
  if (input.payload.demoVerified === true) {
    confidence = 94;
  }

  return {
    verified: result.verified,
    reason: result.reason,
    confidence,
    proofHash: result.contentHash || proofHash,
  };
}

function sampleIndices(total: number, rate: number): Set<number> {
  const count = Math.max(1, Math.ceil(total * rate));
  const indices = new Set<number>();
  for (let i = 0; i < count; i++) {
    indices.add(Math.floor((i * total) / count));
  }
  return indices;
}

function buildComplianceCsv(payments: ResolvedPayment[]): string {
  const header = "eventId,payee,wallet,amountUsd,verified,confidence,proofHash";
  const rows = payments.map(
    (p) =>
      `${p.eventId},${p.payeeName ?? ""},${p.wallet},${p.amountUsd.toFixed(6)},${p.verified},${p.confidence},${p.proofHash}`
  );
  return [header, ...rows].join("\n");
}

export async function processDistribution(
  request: DistributeRequest,
  userId?: string
): Promise<DistributeResult> {
  const sampleRate = request.verifySampleRate ?? 0.1;
  const sampleSet = sampleIndices(request.events.length, sampleRate);

  const resolved: ResolvedPayment[] = [];
  let unresolved = 0;

  for (let i = 0; i < request.events.length; i++) {
    const event = request.events[i];
    const category = categoryForType(event.type);
    const payee = await resolvePayee({
      platform: request.platform,
      platformId: event.platformId,
      payload: event.payload,
    });

    if (!payee.wallet) {
      unresolved++;
      resolved.push({
        eventId: event.eventId,
        wallet: "0x0000000000000000000000000000000000000000",
        payeeName: null,
        amountUsd: event.amountUsd,
        verified: false,
        verifyReason: "Payee could not be resolved — register in contributor registry",
        confidence: 0,
        proofHash: hashProofPayload(event.payload),
        type: event.type,
      });
      continue;
    }

    const verification = verifyEvent({
      type: event.type,
      category,
      payload: event.payload,
      amountUsd: event.amountUsd,
      sampled: sampleSet.has(i),
    });

    resolved.push({
      eventId: event.eventId,
      wallet: payee.wallet,
      payeeName: payee.payeeName,
      amountUsd: event.amountUsd,
      verified: verification.verified,
      verifyReason: verification.reason,
      confidence: verification.confidence,
      proofHash: verification.proofHash,
      type: event.type,
    });
  }

  const verifiedEvents = resolved.filter((p) => p.verified);
  const rejectedEvents = resolved.filter((p) => !p.verified);
  const sampledVerified = verifiedEvents.filter((_, i) => sampleSet.has(i));
  const sampledRejected = rejectedEvents.filter((_, i) => sampleSet.has(i));

  if (
    sampleSet.size > 0 &&
    sampledRejected.length > sampledVerified.length &&
    request.events.length > 3
  ) {
    const batch = await prisma.distributionBatch.create({
      data: {
        userId: userId ?? null,
        platform: request.platform,
        status: "rejected",
        totalAmountUsd: 0,
        payeeCount: 0,
        eventCount: request.events.length,
        verifiedCount: verifiedEvents.length,
        rejectedCount: rejectedEvents.length,
        complianceJson: JSON.stringify({ reason: "Too many suspicious events in sample" }),
      },
    });

    return {
      batchId: batch.id,
      status: "rejected",
      totalAmountUsd: 0,
      payeeCount: 0,
      eventCount: request.events.length,
      verifiedCount: verifiedEvents.length,
      rejectedCount: rejectedEvents.length,
      txHash: null,
      explorerUrl: null,
      payments: resolved,
      complianceCsv: buildComplianceCsv(resolved),
    };
  }

  const payable = verifiedEvents.filter((p) => p.wallet !== "0x0000000000000000000000000000000000000000");
  const aggregated = new Map<string, { wallet: string; name: string | null; total: number }>();
  for (const p of payable) {
    const cur = aggregated.get(p.wallet) ?? { wallet: p.wallet, name: p.payeeName, total: 0 };
    cur.total += p.amountUsd;
    aggregated.set(p.wallet, cur);
  }

  const totalAmountUsd = payable.reduce((s, p) => s + p.amountUsd, 0);
  const batch = await prisma.distributionBatch.create({
    data: {
      userId: userId ?? null,
      platform: request.platform,
      status: "settling",
      totalAmountUsd,
      payeeCount: aggregated.size,
      eventCount: request.events.length,
      verifiedCount: verifiedEvents.length,
      rejectedCount: rejectedEvents.length + unresolved,
    },
  });

  let txHash: string | null = null;
  let explorerUrl: string | null = null;
  let onChain = false;
  let payoutTxs: DistributeResult["payoutTxs"];

  const payoutList = Array.from(aggregated.values()).map((a) => ({
    wallet: a.wallet,
    amountUsd: a.total,
    payeeName: a.name,
  }));

  let offChainReason: string | undefined;

  if (isLiveArcEnabled() && payoutList.length > 0 && totalAmountUsd > 0) {
    const readiness = await getArcReadiness(totalAmountUsd);
    if (!readiness.canDistributeOnChain) {
      offChainReason = readiness.message;
      console.warn("[distribute] Off-chain settlement:", readiness.message);
    } else {
      try {
        const memoPayouts = await sendBatchMemoPayouts({
          batchId: batch.id,
          payouts: payoutList,
        });
        txHash = primaryTxFromPayouts(memoPayouts);
        explorerUrl = txHash ? explorerTxUrl(txHash) : null;
        onChain = memoPayouts.length > 0;
        payoutTxs = memoPayouts.map((p) => ({
          wallet: p.recipient,
          txHash: p.txHash,
          memoId: p.memoId,
          amountUsd: p.amountUsd,
        }));
      } catch (e) {
        console.error("[distribute] Arc memo payout failed:", e);
        await prisma.distributionBatch.update({
          where: { id: batch.id },
          data: { status: "failed" },
        });
        throw e;
      }
    }
  }

  await prisma.distributionBatch.update({
    where: { id: batch.id },
    data: {
      status: onChain ? "settled" : "settled_offchain",
      txHash,
      explorerUrl,
      complianceJson: JSON.stringify({
        payees: payoutList,
        unresolved,
        onChain,
        payoutTxs,
        offChainReason: onChain ? undefined : offChainReason,
      }),
    },
  });

  for (const p of resolved) {
    await prisma.distributionEvent.create({
      data: {
        batchId: batch.id,
        eventId: p.eventId,
        type: p.type,
        platform: request.platform,
        category: categoryForType(p.type),
        amountUsd: p.amountUsd,
        payloadJson: JSON.stringify(
          request.events.find((e) => e.eventId === p.eventId)?.payload ?? {}
        ),
        payeeWallet: p.wallet,
        payeeName: p.payeeName,
        verified: p.verified,
        verifyReason: p.verifyReason,
        confidence: p.confidence,
        proofHash: p.proofHash,
      },
    });
  }

  return {
    batchId: batch.id,
    status: onChain ? "settled" : "settled_offchain",
    totalAmountUsd,
    payeeCount: aggregated.size,
    eventCount: request.events.length,
    verifiedCount: verifiedEvents.length,
    rejectedCount: rejectedEvents.length,
    txHash,
    explorerUrl,
    onChain,
    payoutTxs,
    payments: resolved,
    complianceCsv: buildComplianceCsv(resolved),
  };
}

export async function getTreasuryStats() {
  const [batches, contributors, tasks] = await Promise.all([
    prisma.distributionBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.contributorRegistry.count(),
    prisma.task.findMany({
      where: { status: { in: ["settled", "verified"] } },
      select: { recoveredUsd: true, targetValueUsd: true, category: true },
    }),
  ]);

  const distributedUsd = batches
    .filter((b) => b.status === "settled")
    .reduce((s, b) => s + b.totalAmountUsd, 0);

  const missionSettled = tasks.reduce((s, t) => s + (t.recoveredUsd || t.targetValueUsd), 0);

  return {
    totalDistributedUsd: distributedUsd + missionSettled,
    batchCount: batches.length,
    contributorCount: contributors,
    recentBatches: batches,
    missionSettledUsd: missionSettled,
  };
}
