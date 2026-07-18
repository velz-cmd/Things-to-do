import { describe, expect, it } from "vitest";
import {
  buildGitHubFundingActivity,
  classifyIssue,
  classifyPullRequest,
} from "../../src/lib/github/funding-activity";
import type { RepoIngestResult } from "../../src/lib/github/types";

describe("GitHub funding activity", () => {
  it("classifies accepted work with deterministic evidence rules", () => {
    expect(classifyPullRequest({ title: "Improve guide", labels: [], files: [{ path: "docs/setup.mdx" }] })).toBe("documentation");
    expect(classifyPullRequest({ title: "Patch CVE advisory", labels: [], files: [{ path: "src/auth.ts" }] })).toBe("security");
    expect(classifyIssue({ title: "Answer install question", labels: ["support"] })).toBe("support");
    expect(classifyIssue({ title: "Fix broken pagination", labels: ["bug"] })).toBe("issue_resolution");
  });

  it("creates proof-linked records and transparent contributor totals", () => {
    const ingest: RepoIngestResult = {
      owner: "acme", repo: "tool", fullName: "acme/tool", description: "Tool", stars: 100, forks: 20,
      openIssues: 3, defaultBranch: "main", pushedAt: "2026-07-18T00:00:00.000Z",
      contributors: [{ login: "ada", id: 1, contributions: 5 }],
      pullRequests: [{
        number: 12, title: "Document setup", author: "ada", authorId: 1, state: "closed", merged: true,
        mergedAt: "2026-07-17T00:00:00.000Z", additions: 20, deletions: 2, changedFiles: 1,
        reviewComments: 1, commits: 1, labels: ["docs"], files: [{ path: "docs/setup.md", additions: 20, deletions: 2 }],
        sourceUrl: "https://github.com/acme/tool/pull/12",
        reviews: [{ author: "grace", state: "APPROVED", submittedAt: "2026-07-16T00:00:00.000Z" }],
      }],
      issues: [{ number: 8, title: "Close install question", author: "lin", state: "closed", comments: 3, labels: ["support"], closedAt: "2026-07-15T00:00:00.000Z", sourceUrl: "https://github.com/acme/tool/issues/8" }],
      releases: [{ id: 2, tagName: "v1.0.0", name: "Version 1", author: "ada", publishedAt: "2026-07-18T00:00:00.000Z", sourceUrl: "https://github.com/acme/tool/releases/tag/v1.0.0" }],
      ingestedAt: "2026-07-18T01:00:00.000Z",
    };
    const result = buildGitHubFundingActivity(ingest);
    expect(result.records).toHaveLength(4);
    expect(result.counts.documentation).toBe(1);
    expect(result.counts.review).toBe(1);
    expect(result.counts.support).toBe(1);
    expect(result.counts.release_work).toBe(1);
    expect(result.records.every((record) => record.sourceUrl.startsWith("https://github.com/"))).toBe(true);
    expect(result.contributors.find((item) => item.login === "ada")?.acceptedActivityCount).toBe(2);
  });
});
