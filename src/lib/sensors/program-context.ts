import { prisma } from "@/lib/db";
import { getCommunityBySlug, PROGRAM_TEMPLATES, type ProgramTemplateId } from "@/lib/communities/catalog";
import type { ProgramRules } from "@/lib/communities/types";

export type SensorProgramContext = {
  missionId: string;
  communitySlug: string;
  templateId: ProgramTemplateId;
  rules: ProgramRules;
  founderUserId?: string;
};

function parseRules(raw: string | null): ProgramRules {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ProgramRules;
  } catch {
    return {};
  }
}

/** Resolve active program for a community + RFB template (docs-bounty, security-fund, citation-toll). */
export async function resolveSensorProgramContext(input: {
  communitySlug: string;
  templateId: ProgramTemplateId;
  missionIdOverride?: string;
  founderUserId?: string;
}): Promise<SensorProgramContext | null> {
  const community = getCommunityBySlug(input.communitySlug);
  const template = PROGRAM_TEMPLATES[input.templateId];
  if (!community || !template) return null;

  if (input.missionIdOverride) {
    return {
      missionId: input.missionIdOverride,
      communitySlug: input.communitySlug,
      templateId: input.templateId,
      rules: template.defaultRules as ProgramRules,
      founderUserId: input.founderUserId,
    };
  }

  const program = await prisma.resolveProgram.findFirst({
    where: {
      status: { in: ["active", "deployed"] },
      missionId: { not: null },
      templateId: input.templateId,
      install: { communitySlug: input.communitySlug },
    },
    orderBy: { updatedAt: "desc" },
    include: { install: true },
  });

  if (program?.missionId) {
    return {
      missionId: program.missionId,
      communitySlug: input.communitySlug,
      templateId: input.templateId,
      rules: parseRules(program.rulesJson),
      founderUserId: program.userId,
    };
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    missionId: `sensor-${input.communitySlug}-${input.templateId}-${stamp}`,
    communitySlug: input.communitySlug,
    templateId: input.templateId,
    rules: template.defaultRules as ProgramRules,
    founderUserId: input.founderUserId,
  };
}
