import { askValueAdvisor } from "@/lib/workspace/advisors/synthesize";
import type { AdvisorMessage } from "@/lib/workspace/advisors/synthesize";
import { parseCapitalUsd } from "@/lib/mission/intents";
import { appendMissionTurn } from "@/lib/mission/server/missions";
import { getEcosystem } from "@/lib/mission/server/ecosystems";
import type { MissionRecord } from "@/lib/mission/server/missions";
import type { AdvisorResponse } from "@/lib/workspace/advisors/synthesize";

export async function processMissionMessage(input: {
  userId: string;
  missionId: string;
  question: string;
  messages?: AdvisorMessage[];
  ecosystemId?: string;
}): Promise<AdvisorResponse & { mission: MissionRecord; status: string }> {
  const ecosystem =
    input.ecosystemId ? await getEcosystem(input.userId, input.ecosystemId) : null;

  const result = await askValueAdvisor({
    question: input.question,
    messages: input.messages,
    ecosystem: ecosystem
      ? {
          name: ecosystem.name,
          keywords: ecosystem.keywords,
          repos: ecosystem.repos,
        }
      : undefined,
  });

  const capitalUsd = parseCapitalUsd(input.question) ?? undefined;

  const mission = await appendMissionTurn({
    userId: input.userId,
    missionId: input.missionId,
    userText: input.question,
    ecosystemId: input.ecosystemId,
    resolve: {
      text: result.answer,
      phase: result.phase,
      capability: result.capability,
      findings: result.findings,
      actions: result.actions,
      capitalUsd,
      metadata: {
        traces: result.evidenceUsed,
        stepsRun: result.stepsRun,
      },
    },
  });

  return {
    ...result,
    mission,
    status: mission.status,
  };
}
