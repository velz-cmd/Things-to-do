import { NextResponse } from "next/server";
import { z } from "zod";
import {
  describeSwarmCapabilities,
  isSwarmEnabled,
  runSwarmObject,
  runSwarmText,
} from "@/lib/ai/gateway";

const bodySchema = z.object({
  task: z.string().min(1),
  mode: z.enum(["classify", "analyze", "custom"]).optional(),
  output: z.enum(["object", "text"]).optional(),
  system: z.string().optional(),
  prompt: z.string().optional(),
});

const classifySchema = z.object({
  category: z.string(),
  objective: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export async function GET() {
  const swarm = describeSwarmCapabilities();
  return NextResponse.json({
    swarm,
    description:
      "Unity Swarm — each AI tier validates the previous tier before consensus",
  });
}

export async function POST(req: Request) {
  if (!isSwarmEnabled()) {
    return NextResponse.json(
      { error: "Swarm requires at least two AI providers (Groq, OpenRouter, or Gemini)" },
      { status: 503 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const mode = body.mode ?? "custom";

  if (mode === "classify") {
    const result = await runSwarmObject({
      schema: classifySchema,
      task: body.task,
      producerSystem:
        body.system ??
        "Classify the user mission for RESOLVE. Return category, objective, confidence, reasoning.",
      producerPrompt: body.prompt ?? body.task,
    });
    return NextResponse.json(result);
  }

  if (mode === "analyze" || body.output === "text") {
    const result = await runSwarmText({
      task: body.task,
      producerSystem:
        body.system ??
        "You analyze missions for RESOLVE payout operations. Be factual.",
      producerPrompt: body.prompt ?? body.task,
      maxOutputTokens: 600,
    });
    return NextResponse.json(result);
  }

  if (!body.system || !body.prompt) {
    return NextResponse.json(
      { error: "custom mode requires system and prompt" },
      { status: 400 },
    );
  }

  const result = await runSwarmObject({
    schema: classifySchema,
    task: body.task,
    producerSystem: body.system,
    producerPrompt: body.prompt,
  });
  return NextResponse.json(result);
}
