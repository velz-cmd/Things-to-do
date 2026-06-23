import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyProof } from "@/lib/deputy/proof-engine";

export async function POST(req: Request) {
  const body = await req.json();
  const proofId = String(body.proofId ?? "");
  const proof = await prisma.proof.findUnique({
    where: { id: proofId },
    include: { task: true },
  });
  if (!proof) {
    return NextResponse.json({ error: "Proof not found" }, { status: 404 });
  }

  const payload = JSON.parse(proof.payload);
  const result = verifyProof({
    type: proof.type,
    source: proof.source,
    payload,
    category: proof.task.category,
    targetValueUsd: proof.task.targetValueUsd,
    artifactUrl: proof.artifactUrl ?? undefined,
  });

  await prisma.proof.update({
    where: { id: proofId },
    data: { verified: result.verified },
  });

  return NextResponse.json({ proof, verification: result });
}
