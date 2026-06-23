import { NextResponse } from "next/server";
import { requireReadyUser } from "@/lib/auth/session";
import {
  createTaskFromIntake,
  classifyTaskInput,
} from "@/lib/tasks/task-actions";

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const body = await req.json();
  const input = String(body.input ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "Input required" }, { status: 400 });
  }

  const classification = body.classification ?? classifyTaskInput(input);
  const task = await createTaskFromIntake(
    input,
    classification,
    ready.user.id,
    ready.profile.walletAddress
  );

  return NextResponse.json({ task, classification });
}
