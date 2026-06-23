import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitMerchantProof } from "@/lib/deputy/orchestrator";
import { getSessionUserId } from "@/lib/auth/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionUserId = await getSessionUserId();

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      events: { orderBy: { createdAt: "asc" } },
      proofs: true,
      microPayments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (task.userId && sessionUserId && task.userId !== sessionUserId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (task.userId && !sessionUserId) {
    return NextResponse.json({ error: "Sign in to view this task" }, { status: 401 });
  }

  return NextResponse.json({ task });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  if (body.action === "merchant_proof") {
    const result = await submitMerchantProof({
      taskId: id,
      confirmationId: body.confirmationId ?? `CN-${Date.now()}`,
      refundedAmountUsd: Number(body.refundedAmountUsd),
      merchantId: body.merchantId,
    });
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
