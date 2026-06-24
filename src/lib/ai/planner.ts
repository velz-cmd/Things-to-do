import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import {
  isQwenConfigured,
  qwenModel,
  qwenPlannerModels,
} from "@/lib/ai/qwen";

const planSchema = z.object({
  objective: z.string(),
  steps: z.array(
    z.object({
      agent: z.enum([
        "Planner",
        "Evidence",
        "Executor",
        "Retry",
        "Verification",
        "Escalation",
      ]),
      action: z.string(),
      proofRequired: z.string(),
    })
  ),
  estimatedRecoveryUsd: z.number(),
});

export type DeputyPlan = z.infer<typeof planSchema>;

export async function generateDeputyPlan(input: {
  title: string;
  description: string;
  targetValueUsd: number;
  category: string;
}): Promise<DeputyPlan | null> {
  if (isQwenConfigured()) {
    for (const modelId of qwenPlannerModels()) {
      try {
        const { object } = await generateObject({
          model: qwenModel(modelId, { enableThinking: true }),
          schema: planSchema,
          prompt: plannerPrompt(input),
        });
        return object;
      } catch (e) {
        console.warn(`Qwen planner ${modelId} failed:`, e);
      }
    }
  }

  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return fallbackPlan(input);

  const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  for (const modelId of geminiModels) {
    try {
      const { object } = await generateObject({
        model: google(modelId),
        schema: planSchema,
        prompt: plannerPrompt(input),
      });
      return object;
    } catch (e) {
      console.warn(`Gemini planner ${modelId} failed:`, e);
    }
  }

  return fallbackPlan(input);
}

function plannerPrompt(input: {
  title: string;
  description: string;
  targetValueUsd: number;
  category: string;
}) {
  return `You are RESOLVE Planner — an autonomous consumer advocate.
Create an outcome execution plan (NOT a chat reply).

Task: ${input.title}
Description: ${input.description}
Category: ${input.category}
Target recovery: $${input.targetValueUsd}

Rules:
- Optimize for verified resolution, not advice
- Each step must name proof required before completion
- Use professional escalation language for retry steps
- Keep 4-6 steps maximum`;
}

function fallbackPlan(input: {
  title: string;
  description: string;
  targetValueUsd: number;
}): DeputyPlan {
  return {
    objective: `Recover $${input.targetValueUsd.toFixed(2)} with verified proof`,
    estimatedRecoveryUsd: input.targetValueUsd,
    steps: [
      {
        agent: "Evidence",
        action: "Locate booking reference and eligibility documents",
        proofRequired: "booking_receipt",
      },
      {
        agent: "Executor",
        action: "Submit compensation claim via portal and email",
        proofRequired: "claim_submission_ticket",
      },
      {
        agent: "Retry",
        action: "Send escalation follow-up if no response in 72h",
        proofRequired: "follow_up_sent",
      },
      {
        agent: "Verification",
        action: "Verify refund confirmation against target amount",
        proofRequired: "refund_confirmation_email",
      },
    ],
  };
}
