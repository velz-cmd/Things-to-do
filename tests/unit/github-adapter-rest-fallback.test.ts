import { afterEach, describe, expect, it, vi } from "vitest";
import { ingestRepository } from "@/lib/github/adapter";

const originalGithubToken = process.env.GITHUB_TOKEN;

afterEach(() => {
  process.env.GITHUB_TOKEN = originalGithubToken;
  vi.unstubAllGlobals();
});

function json(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("GitHub REST pull-request fallback", () => {
  it("loads pull-request details before applying the accepted-work size rule", async () => {
    process.env.GITHUB_TOKEN = "";
    vi.stubGlobal("fetch", vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      if (url.endsWith("/repos/velz-cmd/repodiet-e2e-test")) {
        return json({
          full_name: "velz-cmd/repodiet-e2e-test",
          stargazers_count: 0,
          forks_count: 0,
          open_issues_count: 0,
          default_branch: "main",
        });
      }
      if (url.includes("/contributors?")) return json([]);
      if (url.includes("/issues?")) return json([]);
      if (url.includes("/releases?")) return json([]);
      if (url.includes("/pulls?")) {
        return json([{
          number: 7,
          title: "Add RESOLVE accepted-work verification evidence",
          user: { login: "velz-cmd", id: 42 },
          state: "closed",
          merged_at: "2026-08-08T16:51:26Z",
          labels: [],
        }]);
      }
      if (url.endsWith("/pulls/7")) {
        return json({
          number: 7,
          title: "Add RESOLVE accepted-work verification evidence",
          user: { login: "velz-cmd", id: 42 },
          state: "closed",
          merged_at: "2026-08-08T16:51:26Z",
          additions: 18,
          deletions: 0,
          changed_files: 1,
          review_comments: 0,
          commits: 1,
          labels: [],
        });
      }
      if (url.endsWith("/pulls/7/files?per_page=20")) {
        return json([{ filename: "docs/resolve-discover-verification.md", additions: 18, deletions: 0 }]);
      }
      if (url.includes("/contents/package.json")) return json({});
      throw new Error(`Unexpected GitHub request: ${url}`);
    }));

    const result = await ingestRepository("velz-cmd", "repodiet-e2e-test", { prLimit: 8 });

    expect(result?.pullRequests).toEqual([
      expect.objectContaining({
        number: 7,
        author: "velz-cmd",
        additions: 18,
        deletions: 0,
        files: [expect.objectContaining({ path: "docs/resolve-discover-verification.md" })],
      }),
    ]);
  });
});
