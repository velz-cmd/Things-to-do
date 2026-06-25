import { createHash } from "crypto";
import { verifyProof } from "@/lib/deputy/proof-engine";
import { resolvePayee } from "@/lib/registry/resolvers";
import type { DistributionEventInput, DistributionPlatform } from "@/lib/gateway/types";
import { buildSignal, compositeScore } from "@/lib/weight/signals";
import type {
  ContributorWeight,
  ImpactEvaluation,
  ImpactSignal,
  WeightedEvent,
} from "@/lib/weight/types";

function categoryForType(type: string): string {
  if (type.includes("pr_merged") || type.includes("deliverable")) return "bounty";
  if (type.includes("scrobble") || type.includes("stream") || type.includes("shared_link")) {
    return "distribution";
  }
  return "distribution";
}

function scoreEvent(input: {
  type: string;
  payload: Record<string, unknown>;
  verified: boolean;
}): { signals: ImpactSignal[]; rationale: string; impactScore: number } {
  const signals: ImpactSignal[] = [];
  const p = input.payload;

  if (input.type.includes("pr_merged") || input.type.includes("github")) {
    const lines = Number(p.linesChanged ?? p.additions ?? 120);
    const files = Number(p.filesChanged ?? 4);
    const reviews = Number(p.reviewComments ?? 2);
    const hasTests = Boolean(p.hasTests ?? p.testFiles);
    signals.push(
      buildSignal(
        "contribution_complexity",
        Math.min(100, 40 + lines / 8 + files * 4),
        `${lines} lines across ${files} files${hasTests ? " · includes tests" : ""}`,
      ),
    );
    signals.push(
      buildSignal("community_endorsement", Math.min(100, 50 + reviews * 12), `${reviews} review comments`),
    );
    signals.push(buildSignal("proof_integrity", input.verified ? 96 : 30, "Merge verified on GitHub"));
  } else if (input.type.includes("scrobble")) {
    const dur = Number(p.durationSec ?? 0);
    signals.push(
      buildSignal(
        "engagement_depth",
        dur >= 30 ? Math.min(100, 35 + dur / 3) : 5,
        dur >= 30 ? `${dur}s listen (above skip threshold)` : `${dur}s — below 30s royalty floor`,
      ),
    );
    signals.push(
      buildSignal("consistency", Number(p.listenerRepeat ?? 0) > 2 ? 85 : 55, "Listener repeat pattern"),
    );
    signals.push(buildSignal("proof_integrity", input.verified ? 92 : 25, "Scrobble attestation"));
  } else if (input.type.includes("stream")) {
    const dur = Number(p.durationSec ?? 60);
    const chatted = Boolean(p.chatted ?? p.chatMessages);
    signals.push(
      buildSignal("engagement_depth", chatted ? Math.min(100, 50 + dur / 4) : 40, chatted ? "Live chat presence" : "Passive view"),
    );
    signals.push(buildSignal("reach_proxy", Number(p.uniqueViewers ?? 1) * 15, "Concurrent viewers proxy"));
    signals.push(buildSignal("proof_integrity", input.verified ? 94 : 28, "Stream session proof"));
  } else if (input.type.includes("shared_link") || input.type.includes("photo")) {
    signals.push(buildSignal("reach_proxy", Number(p.shareCount ?? 3) * 18, "Share / remix signal"));
    signals.push(buildSignal("proof_integrity", input.verified ? 93 : 32, "EXIF / link verified"));
    signals.push(buildSignal("engagement_depth", 70, "Creative asset attributed"));
  } else {
    signals.push(buildSignal("engagement_depth", 60, "Generic contribution event"));
    signals.push(buildSignal("proof_integrity", input.verified ? 88 : 35, "Policy verification"));
  }

  if (p.suspicious === true || p.bot === true) {
    signals.push(buildSignal("suspicion_penalty", 90, "Bot or suspicious pattern flagged"));
  } else {
    signals.push(buildSignal("suspicion_penalty", 0, "No suspicion flags"));
  }

  const impactScore = compositeScore(signals);
  const top = [...signals].sort((a, b) => b.score * b.weight - a.score * a.weight)[0];
  return {
    signals,
    rationale: top?.rationale ?? `Impact score ${impactScore}`,
    impactScore,
  };
}

export async function evaluateImpactWeights(input: {
  platform: DistributionPlatform;
  events: DistributionEventInput[];
  fundPoolUsd: number;
}): Promise<ImpactEvaluation> {
  const weightedEvents: WeightedEvent[] = [];

  for (const event of input.events) {
    const category = categoryForType(event.type);
    const proof = verifyProof({
      type: event.type,
      source: "gateway",
      payload: event.payload,
      category,
      targetValueUsd: event.amountUsd,
    });
    const verified =
      proof.verified && event.payload.demoVerified !== false && event.payload.suspicious !== true;

    const payee = await resolvePayee({
      platform: input.platform,
      platformId: event.platformId,
      payload: event.payload,
    });

    const payeeKey = payee.wallet ?? event.platformId ?? event.eventId;
    const scored = scoreEvent({ type: event.type, payload: event.payload, verified });

    weightedEvents.push({
      eventId: event.eventId,
      type: event.type,
      platformId: event.platformId,
      payeeKey,
      payeeName: payee.payeeName,
      verified,
      impactScore: verified ? scored.impactScore : 0,
      signals: scored.signals,
      rationale: scored.rationale,
      rawAmountUsd: event.amountUsd,
    });
  }

  const byPayee = new Map<string, ContributorWeight>();
  for (const ev of weightedEvents.filter((e) => e.verified && e.impactScore > 0)) {
    const cur = byPayee.get(ev.payeeKey) ?? {
      payeeKey: ev.payeeKey,
      payeeName: ev.payeeName,
      wallet: ev.payeeKey.startsWith("0x") ? ev.payeeKey : null,
      totalWeight: 0,
      sharePercent: 0,
      payoutUsd: 0,
      eventCount: 0,
      topRationale: ev.rationale,
      events: [],
    };
    cur.totalWeight += ev.impactScore;
    cur.eventCount += 1;
    cur.events.push(ev);
    if (ev.impactScore > (cur.events[0]?.impactScore ?? 0)) {
      cur.topRationale = ev.rationale;
    }
    byPayee.set(ev.payeeKey, cur);
  }

  const contributors = Array.from(byPayee.values());
  const totalWeight = contributors.reduce((s, c) => s + c.totalWeight, 0) || 1;

  for (const c of contributors) {
    c.sharePercent = Math.round((c.totalWeight / totalWeight) * 1000) / 10;
    c.payoutUsd = Math.round((c.totalWeight / totalWeight) * input.fundPoolUsd * 100) / 100;
  }

  contributors.sort((a, b) => b.totalWeight - a.totalWeight);

  const proofPayload = {
    fundPoolUsd: input.fundPoolUsd,
    contributors: contributors.map((c) => ({
      payeeKey: c.payeeKey,
      totalWeight: c.totalWeight,
      sharePercent: c.sharePercent,
      payoutUsd: c.payoutUsd,
    })),
    events: weightedEvents.map((e) => ({
      eventId: e.eventId,
      impactScore: e.impactScore,
      rationale: e.rationale,
    })),
  };

  const weightProofHash = createHash("sha256")
    .update(JSON.stringify(proofPayload))
    .digest("hex");

  return {
    fundPoolUsd: input.fundPoolUsd,
    totalWeight,
    eventCount: input.events.length,
    contributorCount: contributors.length,
    contributors,
    events: weightedEvents,
    weightProofHash,
    evaluatedAt: new Date().toISOString(),
  };
}

/** Convert weighted evaluation into distribution events with proportional amounts. */
export function evaluationToDistributionEvents(
  evaluation: ImpactEvaluation,
  platform: DistributionPlatform,
): DistributionEventInput[] {
  return evaluation.contributors.flatMap((c) =>
    c.events.map((ev, idx) => ({
      eventId: `${ev.eventId}-w${idx}`,
      type: ev.type,
      platformId: ev.platformId,
      amountUsd:
        c.eventCount === 1
          ? c.payoutUsd
          : Math.round((ev.impactScore / c.totalWeight) * c.payoutUsd * 10000) / 10000,
      payload: {
        ...ev.signals.reduce((acc, s) => ({ ...acc, [`signal_${s.id}`]: s.score }), {}),
        impactScore: ev.impactScore,
        weightRationale: ev.rationale,
        weightProofHash: evaluation.weightProofHash,
        demoVerified: true,
      },
    })),
  );
}

export function hashEvaluation(evaluation: ImpactEvaluation): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        weightProofHash: evaluation.weightProofHash,
        fundPoolUsd: evaluation.fundPoolUsd,
        evaluatedAt: evaluation.evaluatedAt,
      }),
    )
    .digest("hex");
}
