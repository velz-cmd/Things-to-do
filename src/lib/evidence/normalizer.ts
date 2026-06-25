import type { NormalizedArtifact } from "@/lib/evidence/types";
import type { GitHubPullRequest, RepoIngestResult } from "@/lib/github/types";

/** Layer 2 — convert GitHub facts into RESOLVE common language. No scoring. */
export function normalizeGithubIngest(ingest: RepoIngestResult): NormalizedArtifact[] {
  const artifacts: NormalizedArtifact[] = [];

  for (const pr of ingest.pullRequests) {
    artifacts.push({
      id: `pr:${pr.number}`,
      type: "pull_request",
      repoFullName: ingest.fullName,
      authorLogin: pr.author,
      timestamp: pr.mergedAt,
      raw: {
        number: pr.number,
        title: pr.title,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        reviewComments: pr.reviewComments,
        labels: pr.labels,
        files: pr.files,
        diffSnippet: pr.diffSnippet,
        merged: pr.merged,
      },
    });
  }

  for (const issue of ingest.issues) {
    artifacts.push({
      id: `issue:${issue.number}`,
      type: "issue",
      repoFullName: ingest.fullName,
      authorLogin: issue.author,
      raw: {
        number: issue.number,
        title: issue.title,
        state: issue.state,
        comments: issue.comments,
        labels: issue.labels,
      },
    });
  }

  return artifacts;
}

export function prSubjectId(prNumber: number): string {
  return `pr:${prNumber}`;
}

export function userSubjectId(login: string): string {
  return `user:${login.toLowerCase()}`;
}

export function repoSubjectId(fullName: string): string {
  return `repo:${fullName}`;
}

export function artifactToPr(artifact: NormalizedArtifact): GitHubPullRequest | null {
  if (artifact.type !== "pull_request") return null;
  const r = artifact.raw;
  return {
    number: Number(r.number),
    title: String(r.title ?? ""),
    author: artifact.authorLogin,
    authorId: 0,
    state: "closed",
    merged: Boolean(r.merged),
    mergedAt: artifact.timestamp,
    additions: Number(r.additions ?? 0),
    deletions: Number(r.deletions ?? 0),
    changedFiles: Number(r.changedFiles ?? 0),
    reviewComments: Number(r.reviewComments ?? 0),
    commits: 1,
    labels: (r.labels as string[]) ?? [],
    diffSnippet: r.diffSnippet as string | undefined,
    files: (r.files as GitHubPullRequest["files"]) ?? [],
  };
}
