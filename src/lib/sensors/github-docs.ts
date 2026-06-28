import type { GitHubPullRequest } from "@/lib/github/types";
import { ingestRepository } from "@/lib/github/adapter";
import { EntityIds } from "@/lib/domain/entities";
import type { Observation } from "@/lib/domain/observation";
import { bayesianPayeeConfidence } from "@/lib/sensors/confidence";
import { sensorProofHash } from "@/lib/sensors/proof";
import type { SensorProgramContext } from "@/lib/sensors/program-context";

const DOC_LABEL_RE = /^(docs?|documentation|typo|readme)$/i;
const DOC_PATH_RE = /(^docs\/|\/docs\/|README|\.mdx?$)/i;
const DOC_TITLE_RE = /\b(doc|readme|tutorial|guide)\b/i;

export function isDocumentationPr(pr: GitHubPullRequest): boolean {
  if (!pr.merged) return false;
  if (pr.labels.some((l) => DOC_LABEL_RE.test(l))) return true;
  if (pr.files?.some((f) => DOC_PATH_RE.test(f.path))) return true;
  if (DOC_TITLE_RE.test(pr.title)) return true;
  return false;
}

function docLineCount(pr: GitHubPullRequest): number {
  return pr.additions + pr.deletions;
}

/** GitHub sensor — merged documentation PRs → observations (RFB #3). */
export async function scanDocsMergedObservations(input: {
  owner: string;
  repo: string;
  program: SensorProgramContext;
  prLimit?: number;
}): Promise<Observation[]> {
  const ingest = await ingestRepository(input.owner, input.repo, {
    prLimit: input.prLimit ?? 12,
  });
  if (!ingest) return [];

  const minLines = input.program.rules.minLines ?? 20;
  const repoRef = {
    type: "repository" as const,
    id: EntityIds.repository(input.owner, input.repo),
    label: ingest.fullName,
  };

  const observations: Observation[] = [];

  for (const pr of ingest.pullRequests) {
    if (!isDocumentationPr(pr)) continue;
    const lines = docLineCount(pr);
    if (lines < minLines) continue;

    const idempotencyKey = `github:docs:${input.owner}/${input.repo}:pr-${pr.number}`;
    const { confidence } = bayesianPayeeConfidence({
      sensorQuality: Math.min(0.95, 0.55 + lines / 500),
      proofStrength: pr.reviewComments > 0 ? 0.85 : 0.7,
      corroboration: pr.labels.length > 0 ? 0.8 : 0.5,
    });

    observations.push({
      id: idempotencyKey,
      idempotencyKey,
      connectorId: "github",
      kind: "code_contribution",
      observedAt: pr.mergedAt ?? ingest.ingestedAt,
      actor: {
        type: "person",
        id: EntityIds.personGitHub(pr.author),
        label: pr.author,
      },
      subject: repoRef,
      object: repoRef,
      metrics: {
        lines_changed: lines,
        review_comments: pr.reviewComments,
        amount_hint_usd: input.program.rules.perMergeUsd ?? 25,
      },
      confidence,
      proofHash: sensorProofHash(idempotencyKey),
      evidenceRefs: [`pr-${pr.number}`, ingest.fullName],
      raw: { prNumber: pr.number, title: pr.title, labels: pr.labels },
      missionId: input.program.missionId,
      policyId: input.program.templateId,
    });
  }

  return observations;
}
