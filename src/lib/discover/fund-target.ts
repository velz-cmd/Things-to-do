import { prisma } from "@/lib/db";
import { getCommunityBySlug, type ProgramTemplateId } from "@/lib/communities/catalog";
import { ensureProfileLinkedInstall } from "@/lib/communities/profile-linked-install";
import { resolvePublicProgramForCommunity } from "@/lib/communities/programs";

export type FundTargetResolution = {
  ok: true;
  programId: string | null;
  programName: string | null;
  communitySlug: string;
  templateId: ProgramTemplateId;
  needsInstall: boolean;
  needsCreate: boolean;
  missionId: string | null;
};

/** Resolve which program a Discover fund action should target. */
export async function resolveFundTarget(input: {
  programId?: string | null;
  communitySlug?: string | null;
  templateId?: string | null;
  missionId?: string | null;
  userId?: string | null;
}): Promise<FundTargetResolution | null> {
  if (input.programId) {
    const program = await prisma.resolveProgram.findUnique({
      where: { id: input.programId },
      include: { install: { select: { communitySlug: true } } },
    });
    if (!program) return null;
    return {
      ok: true,
      programId: program.id,
      programName: program.name,
      communitySlug: program.install?.communitySlug ?? "unknown",
      templateId: program.templateId as ProgramTemplateId,
      needsInstall: false,
      needsCreate: false,
      missionId: program.missionId,
    };
  }

  if (input.missionId) {
    const program = await prisma.resolveProgram.findFirst({
      where: { missionId: input.missionId, status: { in: ["active", "deployed", "draft"] } },
      include: { install: { select: { communitySlug: true } } },
      orderBy: { updatedAt: "desc" },
    });
    if (program) {
      return {
        ok: true,
        programId: program.id,
        programName: program.name,
        communitySlug: program.install?.communitySlug ?? "unknown",
        templateId: program.templateId as ProgramTemplateId,
        needsInstall: false,
        needsCreate: false,
        missionId: program.missionId,
      };
    }
  }

  const communitySlug = input.communitySlug;
  if (!communitySlug || !getCommunityBySlug(communitySlug)) return null;

  const templateId = (input.templateId ?? "docs-bounty") as ProgramTemplateId;

  const sharedPool = await resolvePublicProgramForCommunity(communitySlug, templateId);
  if (sharedPool) {
    return {
      ok: true,
      programId: sharedPool.id,
      programName: sharedPool.name,
      communitySlug,
      templateId: sharedPool.templateId as ProgramTemplateId,
      needsInstall: false,
      needsCreate: false,
      missionId: sharedPool.missionId,
    };
  }

  if (input.userId) {
    let install = await prisma.resolveCommunityInstall.findUnique({
      where: { userId_communitySlug: { userId: input.userId, communitySlug } },
      include: {
        programs: {
          where: { templateId, status: { in: ["active", "deployed", "draft"] } },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    if (!install) {
      await ensureProfileLinkedInstall(input.userId, communitySlug).catch(() => false);
      install = await prisma.resolveCommunityInstall.findUnique({
        where: { userId_communitySlug: { userId: input.userId, communitySlug } },
        include: {
          programs: {
            where: { templateId, status: { in: ["active", "deployed", "draft"] } },
            orderBy: { updatedAt: "desc" },
            take: 1,
          },
        },
      });
    }

    if (install?.programs[0]) {
      const p = install.programs[0];
      return {
        ok: true,
        programId: p.id,
        programName: p.name,
        communitySlug,
        templateId,
        needsInstall: false,
        needsCreate: false,
        missionId: p.missionId,
      };
    }

    return {
      ok: true,
      programId: null,
      programName: null,
      communitySlug,
      templateId,
      needsInstall: !install,
      needsCreate: Boolean(install),
      missionId: null,
    };
  }

  const publicProgram = await prisma.resolveProgram.findFirst({
    where: {
      status: { in: ["active", "deployed"] },
      templateId,
      install: { communitySlug },
    },
    include: { install: { select: { communitySlug: true } } },
    orderBy: [{ budgetUsd: "desc" }, { updatedAt: "desc" }],
  });

  if (publicProgram) {
    return {
      ok: true,
      programId: publicProgram.id,
      programName: publicProgram.name,
      communitySlug,
      templateId,
      needsInstall: false,
      needsCreate: false,
      missionId: publicProgram.missionId,
    };
  }

  return {
    ok: true,
    programId: null,
    programName: null,
    communitySlug,
    templateId,
    needsInstall: true,
    needsCreate: true,
    missionId: null,
  };
}
