import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { submitOutcomeProof } from "@/lib/deputy/orchestrator";

export async function POST(req: Request) {
  const body = await req.json();
  const action = body.action ?? body.event;

  if (action === "pull_request" || body.pull_request) {
    const pr = body.pull_request ?? {};
    const merged = pr.merged === true || body.merged === true;
    const repo = body.repository?.full_name ?? body.repo ?? "demo/logo-bounty";

    const task = await prisma.task.findFirst({
      where: {
        merchantId: repo,
        status: { in: ["executing", "waiting_for_response", "proof_pending", "authorized", "planning"] },
        category: { in: ["bounty", "contributor"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!task) {
      return NextResponse.json(
        { ok: false, message: `No active bounty mission for ${repo}` },
        { status: 404 }
      );
    }

    const result = await submitOutcomeProof({
      taskId: task.id,
      type: "github_pr_merged",
      merchantId: repo,
      payload: {
        merged,
        prMerged: merged,
        prNumber: pr.number ?? body.prNumber ?? 1,
        repo,
        title: pr.title ?? "Logo approved",
        approved: body.approved ?? merged,
        deliverableApproved: body.deliverableApproved ?? merged,
      },
    });

    return NextResponse.json({ ok: true, task: result.task, proof: result.proof });
  }

  return NextResponse.json({ error: "Unsupported webhook event" }, { status: 400 });
}
