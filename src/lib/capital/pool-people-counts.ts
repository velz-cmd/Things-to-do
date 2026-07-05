import { prisma } from "@/lib/db";
import { payeeCategoryForTemplate } from "@/lib/capital/pool-checkpoint-defaults";

export type ProgramPeopleCounts = {
  contributorCount: number;
  authorizationCount: number;
  funderCount: number;
  payeeCategory: string;
};

/** Distinct payees + funders from ledger — used for Discover copy and funder briefs. */
export async function getProgramPeopleCounts(
  programId: string,
  missionId: string | null | undefined,
  templateId: string,
): Promise<ProgramPeopleCounts> {
  const [payeeGroups, funderGroups] = await Promise.all([
    missionId
      ? prisma.paymentAuthorization.groupBy({
          by: ["payeeKeyType", "payeeKey"],
          where: {
            missionId,
            status: {
              in: ["authorized", "pending_funding", "claimable", "claimed", "settled"],
            },
          },
        })
      : Promise.resolve([]),
    prisma.communityFundStake.groupBy({
      by: ["userId"],
      where: { programId, status: { in: ["active", "target_met"] } },
    }),
  ]);

  const authCount = missionId
    ? await prisma.paymentAuthorization.count({
        where: {
          missionId,
          status: {
            in: ["authorized", "pending_funding", "claimable", "claimed", "settled"],
          },
        },
      })
    : 0;

  return {
    contributorCount: payeeGroups.length,
    authorizationCount: authCount,
    funderCount: funderGroups.length,
    payeeCategory: payeeCategoryForTemplate(templateId),
  };
}
