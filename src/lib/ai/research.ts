import { generateTextWithFallback, runSwarmText } from "@/lib/ai/gateway";
import { isSearchConfigured, searchMaintainers, searchRepositories } from "@/lib/search";

/** Llama research layer — long documents, repo notes, bulk summaries. */
export async function summarizeResearch(input: {
  title: string;
  content: string;
  maxWords?: number;
}): Promise<{
  summary: string;
  modelId: string;
  swarm?: { consensus: boolean; confidence: number; stages: unknown[] };
} | null> {
  const trimmed = input.content.trim();
  if (!trimmed) return null;

  const system =
    "You are RESOLVE Research — summarize open-source and operational context for payout missions. Be factual and concise.";
  const prompt = `Title: ${input.title}

Content:
${trimmed.slice(0, 24_000)}

Summarize in ${input.maxWords ?? 200} words or less. Highlight contributors, deliverables, and verification signals.`;

  try {
    const swarm = await runSwarmText({
      task: `Summarize: ${input.title}`,
      producerSystem: system,
      producerPrompt: prompt,
      maxOutputTokens: 800,
    });
    const modelId =
      swarm.stages.find((s) => s.role === "producer")?.modelId ??
      swarm.stages[0]?.modelId ??
      "swarm";
    return {
      summary: swarm.output.trim(),
      modelId,
      swarm: {
        consensus: swarm.consensus,
        confidence: swarm.confidence,
        stages: swarm.stages,
      },
    };
  } catch (e) {
    console.warn("Research summary failed:", e);
    return null;
  }
}

export async function analyzeGithubContext(input: {
  repoFullName: string;
  prTitle?: string;
  prBody?: string;
}): Promise<{
  analysis: string;
  modelId: string;
  searchContext?: { maintainers: string[]; related: string[] };
  swarm?: { consensus: boolean; confidence: number; stages: unknown[] };
} | null> {
  const body = [
    `Repository: ${input.repoFullName}`,
    input.prTitle ? `PR title: ${input.prTitle}` : "",
    input.prBody ? `PR body: ${input.prBody}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let searchBlock = "";
  let searchContext: { maintainers: string[]; related: string[] } | undefined;

  if (isSearchConfigured()) {
    try {
      const [maintainers, related] = await Promise.all([
        searchMaintainers(`${input.repoFullName} contributors maintainers`, 5),
        searchRepositories(`${input.repoFullName} funding sponsors`, 5),
      ]);
      searchContext = {
        maintainers: maintainers.results.map((r) => `${r.title} — ${r.url}`),
        related: related.results.map((r) => `${r.title} — ${r.url}`),
      };
      searchBlock = `

Web search — maintainers:
${searchContext.maintainers.join("\n") || "none"}

Web search — funding / related:
${searchContext.related.join("\n") || "none"}`;
    } catch (e) {
      console.warn("Search enrichment skipped:", e);
    }
  }

  const system =
    "You analyze GitHub work for bounty and contributor payout missions on RESOLVE.";
  const prompt = `${body}${searchBlock}

In 3-5 bullet points: what was delivered, who should be credited, and what proof exists for settlement.`;

  try {
    const swarm = await runSwarmText({
      task: `Analyze GitHub: ${input.repoFullName}`,
      producerSystem: system,
      producerPrompt: prompt,
      maxOutputTokens: 500,
    });
    const modelId =
      swarm.stages.find((s) => s.role === "producer")?.modelId ?? "swarm";
    return {
      analysis: swarm.output.trim(),
      modelId,
      searchContext,
      swarm: {
        consensus: swarm.consensus,
        confidence: swarm.confidence,
        stages: swarm.stages,
      },
    };
  } catch (e) {
    console.warn("GitHub analysis failed:", e);
    return null;
  }
}

/** Quality layer — human-friendly mission verdict / treasury note. */
export async function generateMissionVerdict(input: {
  title: string;
  status: string;
  amountUsd?: number;
  proofSummary?: string;
}): Promise<{ verdict: string; modelId: string } | null> {
  try {
    const { text, meta } = await generateTextWithFallback({
      tier: "quality",
      system:
        "You write clear, professional outcome summaries for founders and operators. No hype.",
      prompt: `Mission: ${input.title}
Status: ${input.status}
Amount: ${input.amountUsd != null ? `$${input.amountUsd}` : "n/a"}
Proof: ${input.proofSummary ?? "pending"}

Write a 2-3 sentence verdict suitable for a treasury dashboard.`,
      maxOutputTokens: 300,
    });
    return { verdict: text.trim(), modelId: meta.modelId };
  } catch (e) {
    console.warn("Mission verdict failed:", e);
    return null;
  }
}
