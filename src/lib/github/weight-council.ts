import { z } from "zod";
import { generateObjectWithFallback, listConfiguredProviders } from "@/lib/ai/gateway/resolve";
import type {
  CouncilAgentVerdict,
  GitHubPullRequest,
  PRWeightVerdict,
  TrustScore,
} from "@/lib/github/types";
import { applyIntentMultiplier, classifyPrCategory } from "@/lib/github/founder-intent";
import type { FounderIntent } from "@/lib/github/types";

const agentSchema = z.object({
  score: z.number().min(1).max(100),
  reasoning: z.string().max(500),
});

function ruleBasedCodeImpact(pr: GitHubPullRequest): CouncilAgentVerdict {
  const lines = pr.additions + pr.deletions;
  const files = pr.changedFiles;
  const hasCore = pr.files.some((f) =>
    /src\/|lib\/|core\/|api\/|pkg\//i.test(f.path),
  );
  const testFiles = pr.files.filter((f) => /test|spec|__tests__/i.test(f.path)).length;
  let score = 30 + Math.min(40, lines / 15) + files * 3;
  if (hasCore) score += 15;
  if (testFiles > 0) score += 10;
  if (lines < 15) score = Math.min(score, 25);
  return {
    agent: "code_impact",
    score: Math.round(Math.min(100, score)),
    reasoning: `${lines} lines · ${files} files${hasCore ? " · touches core" : ""}${testFiles ? ` · ${testFiles} test files` : ""}`,
  };
}

function ruleBasedProjectImpact(pr: GitHubPullRequest): CouncilAgentVerdict {
  const reviews = pr.reviewComments;
  const labels = pr.labels.join(", ");
  let score = 40 + reviews * 8;
  if (pr.labels.some((l) => /enhancement|feature|roadmap/i.test(l))) score += 20;
  if (reviews >= 3) score += 15;
  return {
    agent: "project_impact",
    score: Math.round(Math.min(100, score)),
    reasoning: `${reviews} review comments${labels ? ` · labels: ${labels}` : ""}`,
  };
}

function ruleBasedEconomicImpact(pr: GitHubPullRequest, stars: number): CouncilAgentVerdict {
  const perf = /perf|optim|latency|memory|speed|cost/i.test(pr.title + pr.files.map((f) => f.path).join(" "));
  const deps = pr.files.some((f) => /package\.json|go\.mod|Cargo\.toml|requirements/i.test(f.path));
  let score = 35 + Math.log10(stars + 1) * 8;
  if (perf) score += 25;
  if (deps) score += 15;
  return {
    agent: "economic_impact",
    score: Math.round(Math.min(100, score)),
    reasoning: perf ? "Performance/cost signal detected" : deps ? "Dependency change — adoption ripple" : `Downstream proxy from ${stars.toLocaleString()}★ repo`,
  };
}

async function llmAgentVerdict(
  agent: CouncilAgentVerdict["agent"],
  pr: GitHubPullRequest,
  stars: number,
): Promise<CouncilAgentVerdict | null> {
  const providers = listConfiguredProviders();
  if (!providers.groq && !providers.openrouter && !providers.gemini) return null;

  const prompts: Record<CouncilAgentVerdict["agent"], string> = {
    code_impact: `Analyze this merged PR for code complexity and architectural significance. Penalize whitespace-only changes. Score 1-100.`,
    project_impact: `Analyze maintainer collaboration: review threads, responsiveness, roadmap alignment. Score 1-100.`,
    economic_impact: `Analyze downstream impact: performance, adoption, dependency changes in a ${stars}-star repo. Score 1-100.`,
  };

  const context = `PR #${pr.number}: ${pr.title}
Author: ${pr.author}
+${pr.additions}/-${pr.deletions} lines, ${pr.changedFiles} files
Review comments: ${pr.reviewComments}
Labels: ${pr.labels.join(", ") || "none"}
Files: ${pr.files.slice(0, 8).map((f) => f.path).join(", ")}
${pr.diffSnippet ? `Diff snippet:\n${pr.diffSnippet.slice(0, 800)}` : ""}`;

  try {
    const { object, meta } = await generateObjectWithFallback({
      tier: "fast",
      schema: agentSchema,
      system: prompts[agent],
      prompt: context,
    });
    return {
      agent,
      score: object.score,
      reasoning: object.reasoning,
      modelId: meta.modelId,
    };
  } catch {
    return null;
  }
}

/** Weight Council — 3 independent agents cross-verify each PR. */
export async function evaluatePrWeight(input: {
  pr: GitHubPullRequest;
  trust: TrustScore;
  stars: number;
  founderIntent: FounderIntent;
  useLlm?: boolean;
}): Promise<PRWeightVerdict> {
  const { pr, trust, stars, founderIntent, useLlm = true } = input;

  if (trust.status === "sybil_risk" || trust.score < 30) {
    return {
      prNumber: pr.number,
      author: pr.author,
      category: classifyPrCategory(pr),
      trustScore: trust.score,
      agents: [],
      finalWeight: 0,
      confidence: trust.confidence,
      status: "sybil",
      evidence: [`Trust score ${trust.score} — below sybil threshold`],
    };
  }

  let agents: CouncilAgentVerdict[] = [
    ruleBasedCodeImpact(pr),
    ruleBasedProjectImpact(pr),
    ruleBasedEconomicImpact(pr, stars),
  ];

  if (useLlm) {
    const llmResults = await Promise.all([
      llmAgentVerdict("code_impact", pr, stars),
      llmAgentVerdict("project_impact", pr, stars),
      llmAgentVerdict("economic_impact", pr, stars),
    ]);
    agents = agents.map((rule, i) => {
      const llm = llmResults[i];
      if (!llm) return rule;
      return {
        ...llm,
        score: Math.round(rule.score * 0.4 + llm.score * 0.6),
        reasoning: `${llm.reasoning} (blended with heuristics)`,
      };
    });
  }

  const code = agents.find((a) => a.agent === "code_impact")!.score;
  const project = agents.find((a) => a.agent === "project_impact")!.score;
  const economic = agents.find((a) => a.agent === "economic_impact")!.score;

  const disagreement = Math.abs(code - project);
  let status: PRWeightVerdict["status"] = "verified";
  if (disagreement > 30) status = "manual_review";

  const baseWeight = code * 0.5 + project * 0.3 + economic * 0.2;
  const category = classifyPrCategory(pr);
  const intentAdjusted = applyIntentMultiplier(category, founderIntent, baseWeight);
  const trustMultiplier = 0.5 + (trust.score / 100) * 0.5;
  const finalWeight = Math.round(intentAdjusted * trustMultiplier);

  const evidence: string[] = [
    `PR #${pr.number} merged`,
    pr.title,
    agents[0].reasoning,
    pr.reviewComments > 0 ? `${pr.reviewComments} review comments` : "No review thread",
    `Trust ${trust.score}/100`,
    `Category: ${category} (${founderIntent[category]}% founder priority)`,
  ];

  return {
    prNumber: pr.number,
    author: pr.author,
    category,
    trustScore: trust.score,
    agents,
    finalWeight,
    confidence: Math.min(0.98, trust.confidence * (disagreement > 30 ? 0.7 : 0.95)),
    status,
    evidence,
  };
}
