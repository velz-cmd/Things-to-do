import { z } from "zod";
import type { EvidenceBus } from "@/lib/evidence/bus";
import { evidenceId } from "@/lib/evidence/bus";
import type { WorkerEvidence } from "@/lib/evidence/types";
import { prSubjectId } from "@/lib/evidence/normalizer";
import { generateObjectWithFallback, listConfiguredProviders } from "@/lib/ai/gateway/resolve";
import type { GitHubPullRequest } from "@/lib/github/types";

const codeSchema = z.object({
  changeType: z.enum(["architecture", "feature", "bugfix", "refactor", "docs", "test", "chore"]),
  complexity: z.number().min(1).max(100),
  hasTests: z.boolean(),
  reasoning: z.string().max(400),
});

function heuristicCodeEvidence(pr: GitHubPullRequest): WorkerEvidence {
  const lines = pr.additions + pr.deletions;
  const testFiles = pr.files.filter((f) => /test|spec|__tests__/i.test(f.path)).length;
  const hasCore = pr.files.some((f) => /src\/|lib\/|core\/|pkg\//i.test(f.path));
  const whitespaceOnly = lines < 15 && pr.changedFiles <= 2;

  let changeType: z.infer<typeof codeSchema>["changeType"] = "chore";
  const text = `${pr.title} ${pr.labels.join(" ")}`;
  if (/fix|bug|patch/i.test(text)) changeType = "bugfix";
  else if (/doc|readme/i.test(text)) changeType = "docs";
  else if (/refactor/i.test(text)) changeType = "refactor";
  else if (/feat|feature/i.test(text)) changeType = "feature";
  else if (hasCore) changeType = "architecture";

  let complexity = 30 + Math.min(45, lines / 12) + pr.changedFiles * 2;
  if (hasCore) complexity += 12;
  if (testFiles) complexity += 10;
  if (whitespaceOnly) complexity = Math.min(complexity, 20);

  return {
    id: evidenceId("code", prSubjectId(pr.number), "heuristic"),
    worker: "CodeWorker",
    kind: "code",
    subjectId: prSubjectId(pr.number),
    confidence: whitespaceOnly ? 0.55 : 0.82,
    facts: [
      `Change type: ${changeType}`,
      `Complexity estimate: ${Math.round(complexity)}/100`,
      testFiles ? `Includes ${testFiles} test file(s)` : "No test files detected",
      whitespaceOnly ? "Low substance diff (possible noise — not auto-rejected)" : `Touches ${pr.changedFiles} files`,
      hasCore ? "Touches core module paths" : "Peripheral file changes",
    ],
    metadata: {
      changeType,
      complexity: Math.round(complexity),
      hasTests: testFiles > 0,
      whitespaceOnly,
      modelId: "heuristic",
    },
    producedAt: new Date().toISOString(),
  };
}

/**
 * Worker 4 — Code Worker (OpenRouter when configured).
 * One task = one model. Reads code only. Never decides payouts.
 */
export async function runCodeWorker(bus: EvidenceBus, pr: GitHubPullRequest): Promise<void> {
  const providers = listConfiguredProviders();
  const hasLlm = providers.groq || providers.openrouter || providers.gemini;

  if (!hasLlm || !pr.diffSnippet) {
    bus.publish(heuristicCodeEvidence(pr));
    return;
  }

  try {
    const { object, meta } = await generateObjectWithFallback({
      tier: "fast",
      schema: codeSchema,
      system:
        "You are a code analyst. Analyze PR diffs for change type and complexity. Penalize whitespace-only changes. AI-assisted code is normal — do not flag as bot. Output structured metadata only.",
      prompt: `PR #${pr.number}: ${pr.title}
+${pr.additions}/-${pr.deletions}, files: ${pr.files.map((f) => f.path).join(", ")}
${pr.diffSnippet?.slice(0, 1500) ?? ""}`,
    });

    bus.publish({
      id: evidenceId("code", prSubjectId(pr.number), meta.modelId),
      worker: "CodeWorker",
      kind: "code",
      subjectId: prSubjectId(pr.number),
      confidence: 0.88,
      facts: [
        `Change type: ${object.changeType}`,
        `Complexity: ${object.complexity}/100`,
        object.hasTests ? "Includes tests" : "No tests in diff",
        object.reasoning,
      ],
      metadata: {
        changeType: object.changeType,
        complexity: object.complexity,
        hasTests: object.hasTests,
        modelId: meta.modelId,
      },
      producedAt: new Date().toISOString(),
    });
  } catch {
    bus.publish(heuristicCodeEvidence(pr));
  }
}
