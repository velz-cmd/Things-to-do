import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Mastodon Campaign Provider — lists static community campaigns plus live open tasks.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const instance = searchParams.get("instance") ?? "resolve";

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://resolve-task.vercel.app";

  const liveTasks = await prisma.task.findMany({
    where: { isDemo: false, paused: false },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      id: true,
      title: true,
      status: true,
      budgetUsd: true,
      targetValueUsd: true,
      updatedAt: true,
    },
  });

  const staticCampaigns = [
    {
      id: "resolve-creator-payouts",
      title: "Pay your listeners' artists directly",
      description:
        "User-centric music royalties for self-hosted servers. Your monthly support is split only across artists your community actually played — not global charts.",
      goal_cents: null,
      raised_cents: null,
      currency: "USD",
      url: `${appUrl}/music`,
      cta: "Set up payee registry",
      active: true,
    },
    {
      id: "resolve-open-source-treasury",
      title: "Open-source contributor payouts",
      description:
        "Batch payouts to maintainers, designers, and researchers when work is verified — GitHub, Navidrome scrobbles, shared photos, fediverse posts.",
      goal_cents: null,
      raised_cents: null,
      currency: "USD",
      url: `${appUrl}/missions?panel=distribute`,
      cta: "Open distribution",
      active: true,
    },
  ];

  const taskCampaigns = liveTasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: `Open campaign — budget $${task.budgetUsd.toFixed(2)}, target recovery $${task.targetValueUsd.toFixed(2)}`,
    goal_cents: Math.round(task.targetValueUsd * 100),
    raised_cents: null,
    currency: "USD",
    status: task.status,
    url: `${appUrl}/missions/${task.id}`,
    cta: "View campaign",
    active: task.status !== "settled" && task.status !== "cancelled",
    updated_at: task.updatedAt.toISOString(),
  }));

  return NextResponse.json({
    provider: "resolve",
    instance,
    campaigns: [...staticCampaigns, ...taskCampaigns],
    updated_at: new Date().toISOString(),
  });
}
