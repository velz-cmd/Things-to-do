import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireReadyUser, assertTaskOwner } from "@/lib/auth/session";
import { hashProofPayload } from "@/lib/deputy/state-machine";

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const body = await req.json();
  const taskId = String(body.taskId ?? "");
  const owned = await assertTaskOwner(taskId, ready.user.id);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const payload = body.payload ?? {};
  const contentHash = hashProofPayload(payload);

  const proof = await prisma.proof.create({
    data: {
      taskId,
      type: String(body.type ?? "user_upload"),
      source: String(body.source ?? "user://upload"),
      payload: JSON.stringify(payload),
      contentHash,
      artifactUrl: body.artifactUrl ?? null,
      verified: false,
    },
  });

  return NextResponse.json({ proof });
}
