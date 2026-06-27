import { NextResponse } from "next/server";
import { z } from "zod";
import { requireReadyUser } from "@/lib/auth/session";
import { executeMissionAllocation } from "@/lib/mission/server/execute";
import { getMission } from "@/lib/mission/server/missions";
import { getEcosystem } from "@/lib/mission/server/ecosystems";
import { parseCapitalUsd } from "@/lib/mission/intents";
import { resolveCommunityRepoSignals } from "@/lib/mission/community/repo-signals";

const bodySchema = z.object({
  missionId: z.string().min(1),
  owner: z.string().min(1).optional(),
  repo: z.string().min(1).optional(),
  fundPoolUsd: z.number().positive().optional(),
  dryRun: z.boolean().optional(),
  execute: z.boolean().optional(),
});

export async function POST(req: Request) {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const mission = await getMission(ready.user.id, parsed.data.missionId);
  if (!mission) {
    return NextResponse.json({ error: "Mission not found" }, { status: 404 });
  }

  let owner = parsed.data.owner;
  let repo = parsed.data.repo;
  let fundPoolUsd = parsed.data.fundPoolUsd;

  if (!owner || !repo) {
    const eco =
      mission.ecosystemId ?
        await getEcosystem(ready.user.id, mission.ecosystemId)
      : null;
    const topRepo = eco?.repos[0];
    if (topRepo) {
      owner = topRepo.owner;
      repo = topRepo.repo;
    }
  }

  if (!owner || !repo) {
    const scope = mission.scope ?? "";
    const signals = resolveCommunityRepoSignals({ question: scope });
    const first = signals[0];
    if (first) {
      owner = first.owner;
      repo = first.repo;
    }
  }

  if (!owner || !repo) {
    return NextResponse.json(
      { error: "No repository target — attach repos to ecosystem, name a community (React, Linux…), or specify owner/repo" },
      { status: 400 },
    );
  }

  if (!fundPoolUsd) {
    fundPoolUsd =
      mission.capitalUsd ??
      parseCapitalUsd(mission.scope ?? "") ??
      1000;
  }

  try {
    const result = await executeMissionAllocation({
      userId: ready.user.id,
      missionId: parsed.data.missionId,
      owner,
      repo,
      fundPoolUsd,
      dryRun: parsed.data.dryRun ?? !parsed.data.execute,
      execute: parsed.data.execute ?? false,
    });

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Execution failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
