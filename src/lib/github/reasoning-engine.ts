import type { EvidenceBus } from "@/lib/evidence/bus";
import type { ReasoningVerdict, WorkerEvidence } from "@/lib/evidence/types";
import { prSubjectId, userSubjectId } from "@/lib/evidence/normalizer";
import { classifyPrCategory, applyIntentMultiplier } from "@/lib/github/founder-intent";
import type { FounderIntent, GitHubPullRequest } from "@/lib/github/types";
import { evaluateConfidence } from "@/lib/github/confidence-engine";

function metaNum(evidence: WorkerEvidence[], kind: WorkerEvidence["kind"], key: string): number {
  const item = evidence.find((e) => e.kind === kind);
  const val = item?.metadata[key];
  return typeof val === "number" ? val : 0;
}

/**
 * Reasoning Engine — the ONLY component that synthesizes all worker evidence.
 * Workers never see each other's output. No agent fights.
 */
export function reasonOverEvidence(input: {
  bus: EvidenceBus;
  pr: GitHubPullRequest;
  founderIntent: FounderIntent;
}): ReasoningVerdict {
  const subjectId = prSubjectId(input.pr.number);
  const bundle = input.bus.bySubject(subjectId);
  const identity = input.bus.bySubject(userSubjectId(input.pr.author)).find((e) => e.kind === "identity");

  const complexity = metaNum(bundle, "code", "complexity") || 50;
  const collaboration = metaNum(bundle, "collaboration", "collaboration") || 40;
  const impact = metaNum(bundle, "impact", "impact") || 45;
  const identityConf = (identity?.metadata.identityConfidence as number) ?? 0.5;
  const whitespaceOnly = Boolean(bundle.find((e) => e.kind === "code")?.metadata.whitespaceOnly);

  const confidence = evaluateConfidence({
    complexity,
    collaboration,
    impact,
    identityConfidence: identityConf,
    whitespaceOnly,
    merged: input.pr.merged,
  });

  const category = classifyPrCategory(input.pr);
  const baseWeight = complexity * 0.45 + collaboration * 0.3 + impact * 0.25;
  const intentAdjusted = applyIntentMultiplier(category, input.founderIntent, baseWeight);
  const identityMultiplier = 0.65 + identityConf * 0.35;

  let valueWeight = Math.round(intentAdjusted * identityMultiplier);
  if (confidence.status === "excluded") valueWeight = 0;
  else if (confidence.status === "hold") valueWeight = Math.round(valueWeight * 0.5);

  const reasoning = [
    `PR #${input.pr.number} — ${input.pr.title}`,
    `Code complexity ${complexity}/100 · Collaboration ${collaboration}/100 · Impact ${impact}/100`,
    `Identity confidence ${Math.round(identityConf * 100)}%`,
    `Founder intent category: ${category} (${input.founderIntent[category]}%)`,
    `Trust tier: ${confidence.tier} · Settlement: ${confidence.status}`,
    ...confidence.coherenceFlags.map((f) => `Flag: ${f}`),
  ];

  let status: ReasoningVerdict["status"] = "verified";
  if (confidence.status === "excluded") status = "excluded";
  else if (confidence.status === "founder_review" || confidence.status === "hold") status = "needs_review";

  return {
    subjectId,
    prNumber: input.pr.number,
    author: input.pr.author,
    valueWeight,
    category,
    confidence,
    reasoning,
    workerEvidenceIds: bundle.map((e) => e.id),
    status,
  };
}

export function reasonAllPrs(input: {
  bus: EvidenceBus;
  prs: GitHubPullRequest[];
  founderIntent: FounderIntent;
}): ReasoningVerdict[] {
  return input.prs.map((pr) =>
    reasonOverEvidence({ bus: input.bus, pr, founderIntent: input.founderIntent }),
  );
}
