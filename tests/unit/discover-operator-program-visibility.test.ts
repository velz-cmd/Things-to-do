import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    resolveProgram: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db/ensure-fund-stake-arc-schema", () => ({
  confirmedStakeUsdByProgram: vi.fn(async () => new Map()),
}));

import { prisma } from "@/lib/db";
import { loadOperatorProgramOpportunities } from "@/lib/discover/marketplace/query";

const mockedFindMany = vi.mocked(prisma.resolveProgram.findMany);

/**
 * A Program row whose own rules/policy metadata already looks fully
 * configured (publicationStatus approved, policyStatus active, a real-
 * looking treasury address), but which has NOT actually cleared
 * programEntityVisible's real public-readiness bar - no missionId,
 * meaning it is still an operator-only draft.
 */
function draftReadyLookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "program-1",
    name: "Video watch royalties",
    templateId: "video-royalties",
    status: "draft",
    budgetUsd: 100,
    rulesJson: "{}",
    metadataJson: JSON.stringify({
      publicationStatus: "approved",
      policyStatus: "active",
      treasuryAddress: "0x1111111111111111111111111111111111111111",
    }),
    missionId: null,
    lastDeployAt: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    user: { id: "user-1", displayName: "Operator", githubUsername: null, githubId: "1" },
    install: { communitySlug: "jellyfin", status: "active" },
    fundStakes: [],
    ...overrides,
  };
}

describe("loadOperatorProgramOpportunities", () => {
  it("never reports an undeployed draft as financially ready, even when its own rules config looks complete", async () => {
    mockedFindMany.mockResolvedValueOnce([draftReadyLookingRow()] as never);
    const [item] = await loadOperatorProgramOpportunities("user-1");
    expect(item.marketplaceKind).toBe("pool");
    expect(item.entityState?.financialReadiness).toBe("setup_required");
    expect(item.entityState?.blocker).toBe("Not yet deployed to a public Mission.");
  });

  it("reports a genuinely deployed, mission-linked, actively-installed Program as ready", async () => {
    mockedFindMany.mockResolvedValueOnce([
      draftReadyLookingRow({
        status: "deployed",
        missionId: "mission-1",
        templateId: "security-fund",
        metadataJson: JSON.stringify({
          publicationStatus: "approved",
          policyStatus: "active",
          treasuryAddress: "0x1111111111111111111111111111111111111111",
          sourceConnector: "github",
        }),
      }),
    ] as never);
    const [item] = await loadOperatorProgramOpportunities("user-1");
    expect(item.entityState?.financialReadiness).toBe("ready");
  });
});
