import { askValueAdvisor } from "@/lib/workspace/advisors/synthesize";
import type { AdvisorMessage } from "@/lib/workspace/advisors/synthesize";
import { parseCapitalUsd } from "@/lib/mission/intents";
import { appendMissionTurn } from "@/lib/mission/server/missions";
import { getEcosystem } from "@/lib/mission/server/ecosystems";
import type { MissionRecord } from "@/lib/mission/server/missions";
import type { AdvisorResponse } from "@/lib/workspace/advisors/synthesize";
import type { MissionReport } from "@/lib/mission/mission-report";

export async function processMissionMessage(input: {
  userId: string;
  missionId: string;
  question: string;
  messages?: AdvisorMessage[];
  ecosystemId?: string;
  operatingMode?: import("@/lib/mission/capital-os").OperatingMode;
}): Promise<AdvisorResponse & { mission: MissionRecord; status: string }> {
  const ecosystem =
    input.ecosystemId ? await getEcosystem(input.userId, input.ecosystemId) : null;

  const result = await askValueAdvisor({
    question: input.question,
    messages: input.messages,
    operatingMode: input.operatingMode,
    ecosystem: ecosystem
      ? {
          name: ecosystem.name,
          keywords: ecosystem.keywords,
          repos: ecosystem.repos,
        }
      : undefined,
  });

  const capitalUsd = parseCapitalUsd(input.question) ?? undefined;
  const report: MissionReport = {
    ...result.report,
    missionId: input.missionId,
    objective: input.question,
    persisted: true,
  };

  const mission = await appendMissionTurn({
    userId: input.userId,
    missionId: input.missionId,
    userText: input.question,
    ecosystemId: input.ecosystemId,
    resolve: {
      text: result.report.summary || result.answer,
      phase: result.phase,
      capability: result.capability,
      findings: result.findings,
      actions: result.actions,
      report,
      capitalUsd,
      metadata: {
        traces: result.evidenceUsed,
        stepsRun: result.stepsRun,
        reportId: report.reportId,
        durationMs: result.report.durationMs,
      },
    },
  });

  return {
    ...result,
    report,
    mission,
    status: mission.status,
  };
}
