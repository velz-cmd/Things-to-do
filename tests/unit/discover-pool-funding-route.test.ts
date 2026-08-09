import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  findProgram,
  fundCommunityProgram,
  resolveFundTarget,
  bustCapitalStateCache,
} = vi.hoisted(() => ({
  findProgram: vi.fn(),
  fundCommunityProgram: vi.fn(),
  resolveFundTarget: vi.fn(),
  bustCapitalStateCache: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireReadyUser: vi.fn().mockResolvedValue({
    user: { id: "user-1" },
    profile: { id: "user-1" },
  }),
}));
vi.mock("@/lib/db", () => ({
  prisma: { resolveProgram: { findUnique: findProgram } },
}));
vi.mock("@/lib/capital/fund-program", () => ({ fundCommunityProgram }));
vi.mock("@/lib/capital/state-cache", () => ({ bustCapitalStateCache }));
vi.mock("@/lib/discover/fund-target", () => ({ resolveFundTarget }));
vi.mock("@/lib/settlement/arc-config", () => ({
  ARC_CLIENT_WALLET_ADDRESS: "0x1111111111111111111111111111111111111111",
  isLiveArcEnabled: () => true,
}));

const readyProgram = {
  id: "program-1",
  name: "Verified Work Pool",
  status: "active",
  rulesJson: JSON.stringify({ allocationRule: "verified_activity" }),
  missionId: "mission-1",
  lastDeployAt: null,
  install: { communitySlug: "open-source", status: "active" },
};

describe("Discover Pool funding preflight", () => {
  beforeEach(() => {
    findProgram.mockReset().mockResolvedValue(readyProgram);
    fundCommunityProgram.mockReset().mockResolvedValue({ ok: true });
    resolveFundTarget.mockReset().mockResolvedValue({
      programId: "program-1",
    });
    bustCapitalStateCache.mockReset().mockResolvedValue(undefined);
  });

  it("returns the exact persisted readiness facts before authorization", async () => {
    const { GET } = await import("@/app/api/capital/fund/route");
    const response = await GET(
      new Request("http://localhost/api/capital/fund?programId=program-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      preflight: {
        ready: true,
        publicationState: "published",
        policyState: "active",
        allocationState: "locked",
        treasuryState: "ready",
        network: "Arc Testnet",
        asset: "USDC",
      },
    });
  });

  it("blocks an unpublished Pool with its exact backend reason", async () => {
    findProgram.mockResolvedValue({ ...readyProgram, status: "draft" });
    const { GET } = await import("@/app/api/capital/fund/route");
    const response = await GET(
      new Request("http://localhost/api/capital/fund?programId=program-1"),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.preflight).toMatchObject({
      ready: false,
      code: "POOL_PREFLIGHT_BLOCKED",
      blocker: "This Pool is not published and accepting funds.",
    });
  });

  it("revalidates preflight on submit and never calls the funder when blocked", async () => {
    findProgram
      .mockResolvedValueOnce(readyProgram)
      .mockResolvedValueOnce({ ...readyProgram, missionId: null });
    const { POST } = await import("@/app/api/capital/fund/route");
    const response = await POST(
      new Request("http://localhost/api/capital/fund", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ programId: "program-1", amountUsd: 5 }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: "POOL_PREFLIGHT_BLOCKED",
      error: "This Pool has no locked allocation context.",
    });
    expect(fundCommunityProgram).not.toHaveBeenCalled();
  });
});
