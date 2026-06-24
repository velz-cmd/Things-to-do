import { z } from "zod";
import type { AiTier } from "./models";
import { isGeminiConfigured, isGroqConfigured, isOpenRouterConfigured, isSwarmEnabled } from "./config";
import { generateObjectOnTier, generateTextOnTier, type AiRunMeta } from "./resolve";

const APPROVAL_THRESHOLD = 0.75;

const peerReviewSchema = z.object({
  approved: z.boolean(),
  confidence: z.number().min(0).max(1),
  issues: z.array(z.string()),
  reasoning: z.string(),
});

export type SwarmAgent = "groq" | "llama" | "gemini";

export type SwarmStage = {
  agent: SwarmAgent;
  role: "producer" | "validator" | "arbiter";
  tier: AiTier;
  modelId: string;
  approved: boolean | null;
  confidence: number;
  reasoning: string;
  issues?: string[];
};

export type SwarmResult<T> = {
  output: T;
  consensus: boolean;
  confidence: number;
  stages: SwarmStage[];
};

function agentForProvider(provider: string): SwarmAgent {
  if (provider === "groq") return "groq";
  if (provider === "gemini") return "gemini";
  return "llama";
}

function stageFromMeta(
  meta: AiRunMeta,
  role: SwarmStage["role"],
  review?: z.infer<typeof peerReviewSchema>,
): SwarmStage {
  return {
    agent: agentForProvider(meta.provider),
    role,
    tier: meta.tier,
    modelId: meta.modelId,
    approved: review?.approved ?? (role === "producer" ? null : false),
    confidence: review?.confidence ?? 0,
    reasoning: review?.reasoning ?? "",
    issues: review?.issues,
  };
}

function canRunFullSwarm(): boolean {
  return isGroqConfigured() && isOpenRouterConfigured() && isGeminiConfigured();
}

function canRunValidatorSwarm(): boolean {
  return isGroqConfigured() && isOpenRouterConfigured();
}

/**
 * Unity swarm — each AI tier reviews the previous tier's work.
 * Groq produces → Llama validates → Gemini arbitrates if disputed.
 */
export async function runSwarmObject<T extends z.ZodType>(input: {
  schema: T;
  task: string;
  producerSystem: string;
  producerPrompt: string;
}): Promise<SwarmResult<z.infer<T>>> {
  if (!isSwarmEnabled()) {
    const { object, meta } = await generateObjectOnTier({
      tier: "fast",
      schema: input.schema,
      system: input.producerSystem,
      prompt: input.producerPrompt,
    });
    return {
      output: object,
      consensus: true,
      confidence: 0.7,
      stages: [stageFromMeta(meta, "producer")],
    };
  }

  const stages: SwarmStage[] = [];

  const { object: produced, meta: producerMeta } = await generateObjectOnTier({
    tier: "fast",
    schema: input.schema,
    system: input.producerSystem,
    prompt: input.producerPrompt,
  });
  stages.push(stageFromMeta(producerMeta, "producer"));

  if (!canRunValidatorSwarm()) {
    return { output: produced, consensus: true, confidence: 0.7, stages };
  }

  const { object: validation, meta: validatorMeta } = await generateObjectOnTier({
    tier: "research",
    schema: peerReviewSchema,
    system: `You are the RESOLVE Unity Swarm validator (research layer).
Review the producer's structured output against the original task.
Approve only if category, objectives, and evidence requirements are correct.
Be strict — payout missions need accurate classification.`,
    prompt: `Original task:
${input.task}

Producer output (fast tier):
${JSON.stringify(produced, null, 2)}

Did the producer do the right work? Return JSON with approved, confidence, issues, reasoning.`,
  });
  stages.push(stageFromMeta(validatorMeta, "validator", validation));

  if (validation.approved && validation.confidence >= APPROVAL_THRESHOLD) {
    return {
      output: produced,
      consensus: true,
      confidence: validation.confidence,
      stages,
    };
  }

  if (!isGeminiConfigured()) {
    return {
      output: produced,
      consensus: false,
      confidence: validation.confidence,
      stages,
    };
  }

  const arbiterSchema = z.object({
    consensus: z.boolean(),
    confidence: z.number().min(0).max(1),
    reasoning: z.string(),
    output: input.schema,
  });

  const { object: arbiter, meta: arbiterMeta } = await generateObjectOnTier({
    tier: "quality",
    schema: arbiterSchema,
    system: `You are the RESOLVE Unity Swarm arbiter (quality layer).
The fast tier produced output. The research tier validated it.
If the validator found real issues, correct the output. If the producer was right, confirm it.
Always return the final correct structured output.`,
    prompt: `Original task:
${input.task}

Producer output:
${JSON.stringify(produced, null, 2)}

Validator review:
approved=${validation.approved}, confidence=${validation.confidence}
issues: ${validation.issues.join("; ") || "none"}
reasoning: ${validation.reasoning}

Return consensus, confidence, reasoning, and the final output object.`,
  });

  const finalOutput = (arbiter as { output: z.infer<T> }).output;

  stages.push({
    agent: agentForProvider(arbiterMeta.provider),
    role: "arbiter",
    tier: arbiterMeta.tier,
    modelId: arbiterMeta.modelId,
    approved: arbiter.consensus,
    confidence: arbiter.confidence,
    reasoning: arbiter.reasoning,
    issues: validation.issues,
  });

  return {
    output: finalOutput,
    consensus: arbiter.consensus,
    confidence: arbiter.confidence,
    stages,
  };
}

/** Text pipeline: research produces → quality validates → fast sanity-checks if disputed. */
export async function runSwarmText(input: {
  task: string;
  producerSystem: string;
  producerPrompt: string;
  maxOutputTokens?: number;
}): Promise<SwarmResult<string>> {
  if (!isSwarmEnabled()) {
    const { text, meta } = await generateTextOnTier({
      tier: "research",
      system: input.producerSystem,
      prompt: input.producerPrompt,
      maxOutputTokens: input.maxOutputTokens,
    });
    return {
      output: text,
      consensus: true,
      confidence: 0.7,
      stages: [stageFromMeta(meta, "producer")],
    };
  }

  const stages: SwarmStage[] = [];

  const { text: produced, meta: producerMeta } = await generateTextOnTier({
    tier: "research",
    system: input.producerSystem,
    prompt: input.producerPrompt,
    maxOutputTokens: input.maxOutputTokens,
  });
  stages.push(stageFromMeta(producerMeta, "producer"));

  if (!isGeminiConfigured()) {
    return { output: produced, consensus: true, confidence: 0.7, stages };
  }

  const { object: validation, meta: validatorMeta } = await generateObjectOnTier({
    tier: "quality",
    schema: peerReviewSchema,
    system: `You are the RESOLVE Unity Swarm validator (quality layer).
Review research output for factual accuracy, completeness, and relevance to payout missions.`,
    prompt: `Task:
${input.task}

Research output:
${produced}

Is this analysis correct and complete enough to act on?`,
  });
  stages.push(stageFromMeta(validatorMeta, "validator", validation));

  if (validation.approved && validation.confidence >= APPROVAL_THRESHOLD) {
    return {
      output: produced,
      consensus: true,
      confidence: validation.confidence,
      stages,
    };
  }

  if (!isGroqConfigured()) {
    return {
      output: produced,
      consensus: false,
      confidence: validation.confidence,
      stages,
    };
  }

  const { text: revised, meta: arbiterMeta } = await generateTextOnTier({
    tier: "fast",
    system: `You are the RESOLVE Unity Swarm arbiter (fast layer).
Fix or confirm research output based on the quality validator's review.`,
    prompt: `Task: ${input.task}

Research output:
${produced}

Validator: approved=${validation.approved}, issues: ${validation.issues.join("; ")}
${validation.reasoning}

Return the corrected final analysis (plain text, concise).`,
    maxOutputTokens: input.maxOutputTokens,
  });

  stages.push({
    agent: agentForProvider(arbiterMeta.provider),
    role: "arbiter",
    tier: arbiterMeta.tier,
    modelId: arbiterMeta.modelId,
    approved: true,
    confidence: validation.confidence,
    reasoning: `Revised after validator rejection: ${validation.reasoning}`,
    issues: validation.issues,
  });

  return {
    output: revised,
    consensus: true,
    confidence: validation.confidence,
    stages,
  };
}

export function describeSwarmCapabilities(): {
  enabled: boolean;
  fullPipeline: boolean;
  agents: SwarmAgent[];
  flow: string;
} {
  const agents: SwarmAgent[] = [];
  if (isGroqConfigured()) agents.push("groq");
  if (isOpenRouterConfigured()) agents.push("llama");
  if (isGeminiConfigured()) agents.push("gemini");

  let flow = "Single-tier (swarm disabled or one provider)";
  if (canRunFullSwarm()) {
    flow = "Groq produces → Llama validates → Gemini arbitrates";
  } else if (canRunValidatorSwarm()) {
    flow = "Groq produces → Llama validates";
  } else if (isSwarmEnabled()) {
    flow = "Multi-tier with partial validation";
  }

  return {
    enabled: isSwarmEnabled(),
    fullPipeline: canRunFullSwarm(),
    agents,
    flow,
  };
}
