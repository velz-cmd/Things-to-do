import { NextResponse } from "next/server";
import { z } from "zod";
import {
  candidatesForTier,
  describeSwarmCapabilities,
  generateTextWithFallback,
  listConfiguredProviders,
} from "@/lib/ai/gateway";

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string().min(1),
    }),
  ),
  tier: z.enum(["fast", "research", "quality"]).optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const tier = body.tier ?? "fast";
  if (!candidatesForTier(tier).length) {
    return NextResponse.json(
      { error: "No AI providers configured for this tier" },
      { status: 503 },
    );
  }

  const system = body.messages.find((m) => m.role === "system")?.content;
  const conversation = body.messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const { text, meta } = await generateTextWithFallback({
          tier,
          system,
          prompt: conversation,
        });
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "content", text, meta })}\n\n`,
          ),
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`),
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "AI request failed";
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
  const providers = listConfiguredProviders();
  const swarm = describeSwarmCapabilities();
  return NextResponse.json({
    architecture:
      "Cloudflare Gateway → Unity Swarm (Groq → Llama → Gemini cross-validation)",
    swarm,
    providers,
    tiers: {
      fast: "Intent classification, tagging, routing, quick summaries",
      research: "GitHub/repo analysis, long documents, bulk processing",
      quality: "Final reasoning, mission evaluation, treasury reports",
    },
  });
}
