import { NextResponse } from "next/server";
import { classifyTaskInput } from "@/lib/tasks/classifier";
import { classifyTaskInputWithAi } from "@/lib/tasks/classifier-ai";

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

  const ai = await classifyTaskInputWithAi(input, ruleBased);
  if (ai && ai.confidence >= ruleBased.confidence) {
    return NextResponse.json({ classification: ai, source: "ai" });
  }

  return NextResponse.json({ classification: ruleBased, source: "rules" });
}
