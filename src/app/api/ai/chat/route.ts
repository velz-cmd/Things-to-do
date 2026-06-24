import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isQwenConfigured,
  QWEN_MODELS,
  streamQwenChat,
  type QwenModelId,
} from "@/lib/ai/qwen";

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string().min(1),
    }),
  ),
  model: z
    .enum([QWEN_MODELS.flash, QWEN_MODELS.plus, QWEN_MODELS.max])
    .optional(),
  enableThinking: z.boolean().optional(),
});

export async function POST(req: Request) {
  if (!isQwenConfigured()) {
    return NextResponse.json(
      { error: "DASHSCOPE_API_KEY is not configured" },
      { status: 503 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const model = (body.model ?? QWEN_MODELS.flash) as QwenModelId;
  const enableThinking = body.enableThinking ?? true;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamQwenChat({
          model,
          messages: body.messages,
          enableThinking,
        })) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
          );
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Qwen stream failed";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  return NextResponse.json({
    configured: isQwenConfigured(),
    models: QWEN_MODELS,
    defaultModel: QWEN_MODELS.flash,
    plannerModel: process.env.QWEN_PLANNER_MODEL ?? QWEN_MODELS.plus,
    reasoningModel: process.env.QWEN_REASONING_MODEL ?? QWEN_MODELS.max,
  });
}
