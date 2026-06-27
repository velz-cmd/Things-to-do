import { createKnowledgeEntry } from "@/lib/mission/server/knowledge";
import { executeMissionAllocation } from "@/lib/mission/server/execute";
import { getMission } from "@/lib/mission/server/missions";
import { getEcosystem } from "@/lib/mission/server/ecosystems";
import { parseCapitalUsd } from "@/lib/mission/intents";
import { resolveCommunityRepoSignals } from "@/lib/mission/community/repo-signals";
import { allocateGithubPool } from "@/lib/github/allocate";
import { recordTimelineEvent } from "@/lib/mission/server/timeline";
import { resolveMissionActionType } from "@/lib/mission/actions/resolve-type";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";
import type { MissionActionResult, MissionActionType } from "@/lib/mission/actions/types";

async function resolveTargetRepo(input: {
  userId: string;
  missionId: string;
  owner?: string;
  repo?: string;
  question?: string;
}) {
  if (input.owner && input.repo) {
    return { owner: input.owner, repo: input.repo };
  }

  const mission = await getMission(input.userId, input.missionId);
  if (!mission) return null;

  if (mission.ecosystemId) {
    const eco = await getEcosystem(input.userId, mission.ecosystemId);
    const top = eco?.repos[0];
    if (top) return { owner: top.owner, repo: top.repo };
  }

  const scope = mission.scope ?? input.question ?? "";
  const signals = resolveCommunityRepoSignals({ question: scope });
  const first = signals[0];
  if (first) return { owner: first.owner, repo: first.repo };

  return null;
}

export async function dispatchMissionAction(input: {
  userId: string;
  missionId: string;
  action: CapabilityAction;
  context?: {
    objective?: string;
    summary?: string;
    headline?: string;
    ecosystemId?: string;
    fundPoolUsd?: number;
    owner?: string;
    repo?: string;
  };
}): Promise<MissionActionResult> {
  const actionType = resolveMissionActionType(input.action);

  switch (actionType) {
    case "navigate": {
      const href = input.action.href ?? "/";
      return {
        ok: true,
        actionType,
        message: `Opening ${href}`,
        navigateTo: href,
      };
    }

    case "open_claim":
      return {
        ok: true,
        actionType,
        message: "Opening claim flow",
        navigateTo: input.action.href ?? "/claim",
      };

    case "fund_treasury":
      return {
        ok: true,
        actionType,
        message: "Opening treasury",
        navigateTo: input.action.href ?? "/payments",
      };

    case "save_knowledge": {
      const mission = await getMission(input.userId, input.missionId);
      const title =
        input.context?.headline ??
        input.context?.objective?.slice(0, 120) ??
        mission?.scope?.slice(0, 120) ??
        "Mission insight";
      const summary =
        input.context?.summary ??
        input.action.prompt ??
        mission?.scope ??
        "Saved from mission chat";

      const entry = await createKnowledgeEntry(input.userId, {
        title,
        summary,
        kind: "mission",
        source: "mission-chat",
        missionId: input.missionId,
        ecosystemId: input.context?.ecosystemId ?? mission?.ecosystemId ?? undefined,
      });

      await recordTimelineEvent({
        userId: input.userId,
        missionId: input.missionId,
        eventType: "knowledge_saved",
        title: "Saved to knowledge",
        detail: title,
        severity: "info",
      }).catch(() => undefined);

      return {
        ok: true,
        actionType,
        message: `Saved "${entry.title}" to knowledge`,
        receipt: { knowledgeId: entry.id },
      };
    }

    case "prepare_settlement":
    case "execute_settlement": {
      const target = await resolveTargetRepo({
        userId: input.userId,
        missionId: input.missionId,
        owner: input.context?.owner,
        repo: input.context?.repo,
        question: input.context?.objective,
      });

      if (!target) {
        return {
          ok: false,
          actionType,
          message: "No repository target for settlement",
          error: "Attach repos to an ecosystem or ask about a known community (React, Linux…)",
        };
      }

      const mission = await getMission(input.userId, input.missionId);
      const fundPoolUsd =
        input.context?.fundPoolUsd ??
        mission?.capitalUsd ??
        parseCapitalUsd(input.context?.objective ?? mission?.scope ?? "") ??
        1000;

      const execute = actionType === "execute_settlement";
      const result = await executeMissionAllocation({
        userId: input.userId,
        missionId: input.missionId,
        owner: target.owner,
        repo: target.repo,
        fundPoolUsd,
        dryRun: !execute,
        execute,
      });

      if (!result.ok) {
        return {
          ok: false,
          actionType,
          message: result.error ?? "Settlement failed",
          error: result.error,
        };
      }

      if (result.dryRun) {
        return {
          ok: true,
          actionType,
          message: `Settlement package prepared for ${target.owner}/${target.repo} · $${fundPoolUsd.toLocaleString()}`,
          receipt: { plan: result.plan, dryRun: true },
        };
      }

      return {
        ok: true,
        actionType,
        message: `Settlement initiated for ${target.owner}/${target.repo}`,
        receipt: {
          plan: result.plan,
          settlement: result.settlement,
          dryRun: false,
        },
      };
    }

    case "github_allocate": {
      const target = await resolveTargetRepo({
        userId: input.userId,
        missionId: input.missionId,
        owner: input.context?.owner,
        repo: input.context?.repo,
        question: input.context?.objective,
      });

      if (!target) {
        return {
          ok: false,
          actionType,
          message: "No repository for GitHub allocation",
          error: "Specify a community or attach repos",
        };
      }

      const fundPoolUsd =
        input.context?.fundPoolUsd ??
        parseCapitalUsd(input.context?.objective ?? "") ??
        1000;

      const allocation = await allocateGithubPool({
        owner: target.owner,
        repo: target.repo,
        fundPoolUsd,
        useLlm: true,
      });

      if ("error" in allocation) {
        return {
          ok: false,
          actionType,
          message: allocation.error,
          error: allocation.error,
        };
      }

      return {
        ok: true,
        actionType,
        message: `GitHub allocation prepared for ${target.owner}/${target.repo}`,
        receipt: { allocation },
      };
    }

    case "chat":
    default:
      return {
        ok: true,
        actionType: "chat" satisfies MissionActionType,
        message: input.action.prompt,
      };
  }
}
