import { z } from "zod";
import type { AiTier } from "./models";
import { isGeminiConfigured, isGroqConfigured, isOpenRouterConfigured, isSwarmEnabled } from "./config";
import { generateObjectOnTier, generateObjectWithFallback, generateTextOnTier, generateTextWithFallback, type AiRunMeta } from "./resolve";

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

async function validatePeer(input: {
  tier: AiTier;
  task: string;
  output: string;
}): Promise<{ validation: z.infer<typeof peerReviewSchema>; meta: AiRunMeta } | null> {
  try {
    return await generateObjectOnTier({
      tier: input.tier,
      schema: peerReviewSchema,
      system: `You are a RESOLVE Unity Swarm peer reviewer.
Approve only if the output matches the task. Return approved, confidence (0-1), issues, reasoning.`,
      prompt: `Task:\n${input.task}\n\nOutput to review:\n${input.output}\n\nIs this correct?`,
    }).then(({ object, meta }) => ({ validation: object, meta }));
  } catch (e) {
    console.warn(`[swarm] validator (${input.tier}) failed:`, e);
    try {
      const { object, meta } = await generateObjectWithFallback({
        tier: input.tier,
        schema: peerReviewSchema,
        system: "RESOLVE swarm peer review. Return approved, confidence, issues, reasoning.",
        prompt: `Task: ${input.task}\nOutput: ${input.output.slice(0, 4000)}`,
      });
      return { validation: object, meta };
    } catch {
      return null;
    }
  }
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

  let produced: z.infer<T>;
  let producerMeta: AiRunMeta;
  try {
    const result = await generateObjectWithFallback({
      tier: "fast",
      schema: input.schema,
      system: input.producerSystem,
      prompt: input.producerPrompt,
    });
    produced = result.object;
    producerMeta = result.meta;
  } catch (e) {
    throw e;
  }
  stages.push(stageFromMeta(producerMeta, "producer"));

  if (!canRunValidatorSwarm()) {
    return { output: produced, consensus: true, confidence: 0.7, stages };
  }

  const validatorResult = await validatePeer({
    tier: "research",
    task: input.task,
    output: JSON.stringify(produced),
  });

  if (!validatorResult) {
    return { output: produced, consensus: true, confidence: 0.65, stages };
  }

  const { validation, meta: validatorMeta } = validatorResult;
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

  try {
    const { object: arbiter, meta: arbiterMeta } = await generateObjectOnTier({
      tier: "quality",
      schema: arbiterSchema,
      system: `You are the RESOLVE Unity Swarm arbiter (quality layer).
If the validator found real issues, correct the output. If the producer was right, confirm it.`,
      prompt: `Task: ${input.task}
Producer: ${JSON.stringify(produced)}
Validator: approved=${validation.approved}, issues=${validation.issues.join("; ")}
Return consensus, confidence, reasoning, and final output.`,
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
  } catch (e) {
    console.warn("[swarm] arbiter failed, using producer output:", e);
    return {
      output: produced,
      consensus: false,
      confidence: validation.confidence,
      stages,
    };
  }
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

  let produced: string;
  let producerMeta: AiRunMeta;
  try {
    const result = await generateTextWithFallback({
      tier: "research",
      system: input.producerSystem,
      prompt: input.producerPrompt,
      maxOutputTokens: input.maxOutputTokens ?? 500,
    });
    produced = result.text;
    producerMeta = result.meta;
  } catch (e) {
    const fallback = await generateTextWithFallback({
      tier: "fast",
      system: input.producerSystem,
      prompt: input.producerPrompt,
      maxOutputTokens: input.maxOutputTokens ?? 500,
    });
    produced = fallback.text;
    producerMeta = fallback.meta;
  }
  stages.push(stageFromMeta(producerMeta, "producer"));

  if (!isGroqConfigured()) {
    return { output: produced, consensus: true, confidence: 0.7, stages };
  }

  const validatorResult = await validatePeer({
    tier: "fast",
    task: input.task,
    output: produced,
  });

  if (!validatorResult) {
    return { output: produced, consensus: true, confidence: 0.65, stages };
  }

  const { validation, meta: validatorMeta } = validatorResult;
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

  try {
    const { text: revised, meta: arbiterMeta } = await generateTextWithFallback({
      tier: "quality",
      system: "RESOLVE Unity Swarm arbiter. Fix research output based on validator review.",
      prompt: `Task: ${input.task}\nOutput: ${produced}\nIssues: ${validation.issues.join("; ")}\nReturn corrected analysis.`,
      maxOutputTokens: input.maxOutputTokens ?? 500,
    });

    stages.push({
      agent: agentForProvider(arbiterMeta.provider),
      role: "arbiter",
      tier: arbiterMeta.tier,
      modelId: arbiterMeta.modelId,
      approved: true,
      confidence: validation.confidence,
      reasoning: `Revised: ${validation.reasoning}`,
      issues: validation.issues,
    });

    return {
      output: revised,
      consensus: true,
      confidence: validation.confidence,
      stages,
    };
  } catch (e) {
    console.warn("[swarm] text arbiter failed:", e);
    return {
      output: produced,
      consensus: false,
      confidence: validation.confidence,
      stages,
    };
  }
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
