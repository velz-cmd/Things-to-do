import { generateTextWithFallback } from "@/lib/ai/gateway";

/** Llama research layer — long documents, repo notes, bulk summaries. */
export async function summarizeResearch(input: {
  title: string;
  content: string;
  maxWords?: number;
}): Promise<{ summary: string; modelId: string } | null> {
  const trimmed = input.content.trim();
  if (!trimmed) return null;

  try {
    const { text, meta } = await generateTextWithFallback({
      tier: "research",
      system:
        "You are RESOLVE Research — summarize open-source and operational context for payout missions. Be factual and concise.",
      prompt: `Title: ${input.title}

Content:
${trimmed.slice(0, 24_000)}

Summarize in ${input.maxWords ?? 200} words or less. Highlight contributors, deliverables, and verification signals.`,
      maxOutputTokens: 800,
    });
    return { summary: text.trim(), modelId: meta.modelId };
  } catch (e) {
    console.warn("Research summary failed:", e);
    return null;
  }
}

export async function analyzeGithubContext(input: {
  repoFullName: string;
  prTitle?: string;
  prBody?: string;
}): Promise<{ analysis: string; modelId: string } | null> {
  const body = [
    `Repository: ${input.repoFullName}`,
    input.prTitle ? `PR title: ${input.prTitle}` : "",
    input.prBody ? `PR body: ${input.prBody}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text, meta } = await generateTextWithFallback({
      tier: "research",
      system:
        "You analyze GitHub work for bounty and contributor payout missions on RESOLVE.",
      prompt: `${body}

In 3-5 bullet points: what was delivered, who should be credited, and what proof exists for settlement.`,
      maxOutputTokens: 500,
    });
    return { analysis: text.trim(), modelId: meta.modelId };
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
