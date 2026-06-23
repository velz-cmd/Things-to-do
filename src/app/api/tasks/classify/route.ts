import { NextResponse } from "next/server";
import { classifyTaskInput } from "@/lib/tasks/classifier";

export async function POST(req: Request) {
  const body = await req.json();
  const input = String(body.input ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "Input required" }, { status: 400 });
  }

  const classification = classifyTaskInput(input);
  return NextResponse.json({ classification });
}
