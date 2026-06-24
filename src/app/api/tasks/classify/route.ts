import { NextResponse } from "next/server";
import { classifyTaskInput } from "@/lib/tasks/classifier";
import { classifyTaskInputWithAi } from "@/lib/tasks/classifier-ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const input = String(body.input ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "Input required" }, { status: 400 });
  }

  const ruleBased = classifyTaskInput(input);

  if (ruleBased.confidence >= 0.85) {
    return NextResponse.json({ classification: ruleBased, source: "rules" });
  }

  const aiResult = await classifyTaskInputWithAi(input, ruleBased);
  if (aiResult && aiResult.classification.confidence >= ruleBased.confidence) {
    return NextResponse.json({
      classification: aiResult.classification,
      source: aiResult.swarm ? "swarm" : "ai",
      swarm: aiResult.swarm
        ? {
            consensus: aiResult.swarm.consensus,
            confidence: aiResult.swarm.confidence,
            stages: aiResult.swarm.stages,
          }
        : undefined,
    });
  }

  return NextResponse.json({ classification: ruleBased, source: "rules" });
}
