import { z } from "zod";
import {
  isGroqConfigured,
  isSwarmEnabled,
  runSwarmObject,
} from "@/lib/ai/gateway";
import type { TaskClassification } from "./classifier";

const classificationSchema = z.object({
  category: z.string(),
  company: z.string().nullable(),
  objective: z.string(),
  secondaryObjective: z.string().optional(),
  requiredEvidence: z.array(z.string()),
  requiredConnectors: z.array(z.string()),
  missingInputs: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  isDemo: z.boolean(),
  suggestedTitle: z.string(),
  targetValueUsd: z.number().nullable(),
  merchantId: z.string().nullable(),
  question: z.string().optional(),
});

export function canClassifyWithAi(): boolean {
  return isGroqConfigured();
}

const CLASSIFIER_SYSTEM = `You classify financial outcome missions for RESOLVE (refunds, subscriptions, bounties, founder distributions, parcel claims).
Return JSON only. Categories include: airline_refund, subscription_cancellation, parcel_claim, charge_dispute, wallet_guardian, bounty, distribution, manual.
Use requiredConnectors from: gmail, browser, arc, wallet.`;

/** Groq fast layer with Unity Swarm cross-validation when enabled. */
export async function classifyTaskInputWithAi(
  input: string,
  ruleHint?: TaskClassification,
): Promise<{
  classification: TaskClassification;
  swarm?: import("@/lib/ai/gateway").SwarmResult<TaskClassification>;
} | null> {
  if (!canClassifyWithAi()) return null;

  const prompt = `User input: ${input}
${ruleHint ? `Rule-based hint (may improve): ${JSON.stringify(ruleHint)}` : ""}`;

  try {
    if (isSwarmEnabled()) {
      const swarm = await runSwarmObject({
        schema: classificationSchema,
        task: input,
        producerSystem: CLASSIFIER_SYSTEM,
        producerPrompt: prompt,
      });
      const classification = {
        ...swarm.output,
        confidence: Math.max(swarm.output.confidence, swarm.confidence),
      } as TaskClassification;
      return { classification, swarm };
    }

    const { generateObjectWithFallback } = await import("@/lib/ai/gateway");
    const { object } = await generateObjectWithFallback({
      tier: "fast",
      schema: classificationSchema,
      system: CLASSIFIER_SYSTEM,
      prompt,
    });
    return { classification: object as TaskClassification };
  } catch (e) {
    console.warn("AI classification failed:", e);
    return null;
  }
}
