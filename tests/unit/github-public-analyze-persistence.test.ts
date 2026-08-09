import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoIngestResult } from "@/lib/github/types";

const {
  ingestRepository,
  persistGithubEvidence,
  persistOssOpportunitySnapshot,
  rateLimitRequest,
} = vi.hoisted(() => ({
  ingestRepository: vi.fn(),
  persistGithubEvidence: vi.fn(),
  persistOssOpportunitySnapshot: vi.fn(),
  rateLimitRequest: vi.fn(),
}));

vi.mock("@/lib/github/adapter", () => ({ ingestRepository }));
vi.mock("@/lib/github/oss-scan-store", () => ({
  persistOssOpportunitySnapshot,
}));
vi.mock("@/lib/github/evidence-store", () => ({ persistGithubEvidence }));
vi.mock("@/lib/cache/rate-limit", () => ({
  getRequestClientId: () => "ip:test",
  rateLimitRequest,
}));

const repository: RepoIngestResult = {
  owner: "velz-cmd",
  repo: "repodiet-e2e-test",
  fullName: "velz-cmd/repodiet-e2e-test",
  stars: 0,
  forks: 0,
  openIssues: 0,
  defaultBranch: "main",
  contributors: [{ login: "velz-cmd", id: 42 }],
  pullRequests: [
    {
      number: 7,
      title: "Add RESOLVE accepted-work verification evidence",
      author: "velz-cmd",
      authorId: 42,
      state: "closed",
      merged: true,
      mergedAt: "2026-08-08T16:51:26.000Z",
      additions: 18,
      deletions: 0,
      changedFiles: 1,
      reviewComments: 0,
      commits: 1,
      labels: [],
      sourceUrl: "https://github.com/velz-cmd/repodiet-e2e-test/pull/7",
      files: [
        {
          path: "docs/resolve-discover-verification.md",
          additions: 18,
          deletions: 0,
        },
      ],
    },
  ],
  issues: [],
  releases: [],
  dependencies: [],
  ingestedAt: "2026-08-08T17:00:00.000Z",
};

describe("public GitHub analysis persistence", () => {
  beforeEach(() => {
    ingestRepository.mockReset();
    persistOssOpportunitySnapshot.mockReset();
    persistGithubEvidence.mockReset().mockResolvedValue([]);
    rateLimitRequest.mockReset().mockResolvedValue({
      success: true,
      remaining: 5,
      resetAt: Date.now() + 60_000,
    });
  });

  it("publishes accepted work into the persisted Discover snapshot", async () => {
    ingestRepository.mockResolvedValue(repository);
    persistOssOpportunitySnapshot.mockResolvedValue({
      fingerprint: "snapshot-7",
      observedAt: "2026-08-08T17:00:00.000Z",
    });
    const { POST } = await import("@/app/api/github/analyze/route");

    const response = await POST(
      new Request("http://localhost/api/github/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          owner: " VELZ-CMD ",
          repo: " RepoDiet-E2E-Test ",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      persisted: true,
      fingerprint: "snapshot-7",
      observedAt: "2026-08-08T17:00:00.000Z",
      ingest: { fullName: "velz-cmd/repodiet-e2e-test", prCount: 1 },
    });
    expect(persistOssOpportunitySnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "velz-cmd/repodiet-e2e-test",
        activity: expect.objectContaining({
          records: expect.arrayContaining([
            expect.objectContaining({
              title: "Add RESOLVE accepted-work verification evidence",
              actor: "velz-cmd",
              category: "documentation",
            }),
          ]),
        }),
      }),
    );
    expect(persistGithubEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        opportunity: expect.objectContaining({
          fullName: "velz-cmd/repodiet-e2e-test",
        }),
        fingerprint: "snapshot-7",
        observedAt: "2026-08-08T17:00:00.000Z",
      }),
    );
    expect(ingestRepository).toHaveBeenCalledWith(
      "velz-cmd",
      "repodiet-e2e-test",
    );
    expect(rateLimitRequest).toHaveBeenCalledWith(
      "github:analyze:ip:test",
      10,
      60,
    );
  });

  it("does not publish a transient success when persistence fails", async () => {
    ingestRepository.mockResolvedValue(repository);
    persistOssOpportunitySnapshot.mockRejectedValue(
      new Error("database failed with TEST_API_KEY:do-not-expose"),
    );
    const { POST } = await import("@/app/api/github/analyze/route");

    const response = await POST(
      new Request("http://localhost/api/github/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner: "velz-cmd", repo: "repodiet-e2e-test" }),
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toMatchObject({
      code: "PERSISTENCE_UNAVAILABLE",
      persisted: false,
    });
    expect(text).not.toContain("TEST_API_KEY");
    expect(text).not.toContain("do-not-expose");
  });

  it("does not claim the Work is available when canonical Evidence fails", async () => {
    ingestRepository.mockResolvedValue(repository);
    persistOssOpportunitySnapshot.mockResolvedValue({
      fingerprint: "snapshot-7",
      observedAt: "2026-08-08T17:00:00.000Z",
    });
    persistGithubEvidence.mockRejectedValue(
      new Error("evidence failed with TEST_DATABASE_SECRET"),
    );
    const { POST } = await import("@/app/api/github/analyze/route");

    const response = await POST(
      new Request("http://localhost/api/github/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          owner: "velz-cmd",
          repo: "repodiet-e2e-test",
        }),
      }),
    );
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toMatchObject({
      code: "PERSISTENCE_UNAVAILABLE",
      persisted: false,
    });
    expect(text).not.toContain("TEST_DATABASE_SECRET");
  });

  it("rejects malformed repository coordinates before calling GitHub", async () => {
    const { POST } = await import("@/app/api/github/analyze/route");

    const response = await POST(
      new Request("http://localhost/api/github/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner: "velz-cmd/other", repo: "../private" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(ingestRepository).not.toHaveBeenCalled();
    expect(persistOssOpportunitySnapshot).not.toHaveBeenCalled();
  });

  it("rate limits expensive public analysis before ingest", async () => {
    rateLimitRequest.mockResolvedValue({
      success: false,
      remaining: 0,
      resetAt: Date.now() + 30_000,
    });
    const { POST } = await import("@/app/api/github/analyze/route");

    const response = await POST(
      new Request("http://localhost/api/github/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner: "velz-cmd", repo: "repodiet-e2e-test" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(ingestRepository).not.toHaveBeenCalled();
    expect(persistOssOpportunitySnapshot).not.toHaveBeenCalled();
  });
});
