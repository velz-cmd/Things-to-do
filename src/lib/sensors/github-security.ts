import { githubFetch } from "@/lib/github/client";
import { EntityIds } from "@/lib/domain/entities";
import type { Observation } from "@/lib/domain/observation";
import { bayesianPayeeConfidence } from "@/lib/sensors/confidence";
import { sensorProofHash } from "@/lib/sensors/proof";
import type { SensorProgramContext } from "@/lib/sensors/program-context";

type GhIssue = {
  number: number;
  title: string;
  user: { login: string };
  state: string;
  closed_at: string | null;
  labels: { name: string }[];
  body?: string;
};

const SECURITY_LABEL_RE = /security|cve|vulnerability|advisory|dependabot/i;

function isSecurityIssue(issue: GhIssue): boolean {
  return issue.labels.some((l) => SECURITY_LABEL_RE.test(l.name));
}

/** GitHub sensor — security advisory / CVE issues → observations (RFB #4). */
export async function scanSecurityAdvisoryObservations(input: {
  owner: string;
  repo: string;
  program: SensorProgramContext;
  limit?: number;
}): Promise<Observation[]> {
  const issues =
    (await githubFetch<GhIssue[]>(
      `https://api.github.com/repos/${input.owner}/${input.repo}/issues?state=closed&per_page=${input.limit ?? 20}&sort=updated`,
      { revalidate: 1800 },
    )) ?? [];

  const repoRef = {
    type: "repository" as const,
    id: EntityIds.repository(input.owner, input.repo),
    label: `${input.owner}/${input.repo}`,
  };

  const observations: Observation[] = [];

  for (const issue of issues) {
    if (!issue.closed_at) continue;
    if (!isSecurityIssue(issue)) continue;

    const idempotencyKey = `github:security:${input.owner}/${input.repo}:issue-${issue.number}`;
    const cveMatch = issue.title.match(/CVE-\d{4}-\d+/i);
    const { confidence } = bayesianPayeeConfidence({
      sensorQuality: cveMatch ? 0.9 : 0.75,
      proofStrength: 0.8,
      corroboration: issue.labels.length >= 2 ? 0.85 : 0.6,
    });

    observations.push({
      id: idempotencyKey,
      idempotencyKey,
      connectorId: "github",
      kind: "other",
      observedAt: issue.closed_at,
      actor: {
        type: "person",
        id: EntityIds.personGitHub(issue.user.login),
        label: issue.user.login,
      },
      subject: repoRef,
      object: repoRef,
      metrics: {
        amount_hint_usd: input.program.rules.perCveUsd ?? 150,
      },
      confidence,
      proofHash: sensorProofHash(idempotencyKey),
      evidenceRefs: [
        `issue-${issue.number}`,
        cveMatch?.[0] ?? `security:${issue.number}`,
      ],
      raw: { issueNumber: issue.number, title: issue.title, labels: issue.labels.map((l) => l.name) },
      missionId: input.program.missionId,
      policyId: input.program.templateId,
    });
  }

  return observations;
}
