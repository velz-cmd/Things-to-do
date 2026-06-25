import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Mastodon Campaign Provider — single campaign detail (Task-backed).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (id === "resolve-creator-payouts") {
    return NextResponse.json({
      id,
      title: "Pay your listeners' artists directly",
      description: "User-centric music royalties for self-hosted Navidrome servers.",
      url: "https://resolve-task.vercel.app/music",
      active: true,
    });
  }

  if (id === "resolve-open-source-treasury") {
    return NextResponse.json({
      id,
      title: "Open-source contributor payouts",
      description: "Batch payouts when work is verified across GitHub, scrobbles, photos, and fediverse.",
      url: "https://resolve-task.vercel.app/missions?panel=distribute",
      active: true,
    });
  }

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      user: { select: { displayName: true, email: true } },
      _count: { select: { events: true, proofs: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: task.id,
    title: task.title,
    description: task.company ?? task.title,
    status: task.status,
    goal: task.targetValueUsd,
    budget: task.budgetUsd,
    creator: task.user?.displayName ?? "Anonymous",
    eventCount: task._count.events,
    proofCount: task._count.proofs,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    donateUrl: `https://resolve-task.vercel.app/missions/${task.id}`,
    activityPub: {
      type: "Note",
      summary: task.title,
      content: task.company ?? task.title,
      attributedTo: "https://resolve-task.vercel.app",
    },
  });
}
