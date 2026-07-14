import { createHash } from "node:crypto";
import type { OutcomeAdapter, OutcomeSnapshotValue } from "@/lib/outcomes/adapters/types";
import { calculateIncrementalUnits } from "@/lib/outcomes/campaign-lifecycle";

type PullRequest = { id: number; number: number; title: string; body?: string | null; html_url: string; merged_at: string | null; updated_at?: string; user?: { login?: string } };
function target(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.hostname !== "github.com") throw new Error("Use a github.com pull request URL.");
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
  if (!match) throw new Error("Use a canonical GitHub pull request URL.");
  return { owner: match[1]!, repo: match[2]!, number: match[3]!, canonicalUrl: `https://github.com/${match[1]}/${match[2]}/pull/${match[3]}` };
}
async function load(rawUrl: string): Promise<PullRequest> {
  const item = target(rawUrl);
  const headers: Record<string, string> = { accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${item.owner}/${item.repo}/pulls/${item.number}`, { headers, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}.`);
  return response.json() as Promise<PullRequest>;
}
function snapshot(url: string, pr: PullRequest): OutcomeSnapshotValue {
  const observedAt = new Date().toISOString();
  const value = pr.merged_at ? BigInt(1) : BigInt(0);
  return { adapterId: "github", sourceObjectId: String(pr.id), objectUrl: pr.html_url || url, objectLabel: `#${pr.number} ${pr.title}`, unitType: "events", value, observedAt, contentHash: createHash("sha256").update(`${pr.id}:${pr.merged_at ?? "open"}`).digest("hex") };
}
export const githubOutcomeAdapter: OutcomeAdapter = {
  id: "github", label: "GitHub pull request evidence", status: "live", supportedOutcomeTypes: ["repository_pr_merged", "documentation_merged", "security_fix_accepted"],
  async validateSource({ url }) { try { const pr = await load(url); return { valid: true, externalId: String(pr.id), title: pr.title }; } catch (error) { return { valid: false, blocker: error instanceof Error ? error.message : "GitHub source unavailable." }; } },
  async captureBaseline({ url }) { return snapshot(url, await load(url)); },
  async synchronize({ url, baseline }) { const current = snapshot(url, await load(url)); return { snapshot: current, incrementalValue: calculateIncrementalUnits(current.value, baseline.value) }; },
  async verifyOwnership({ url, challenge }) {
    try {
      const pr = await load(url);
      if (!pr.body?.includes(challenge)) return { verified: false, blocker: "Add the RESOLVE verification code to the pull request description, then retry." };
      return { verified: true, proof: { provider: "github", pullRequestId: String(pr.id), author: pr.user?.login ?? null, updatedAt: pr.updated_at ?? null } };
    } catch (error) { return { verified: false, blocker: error instanceof Error ? error.message : "GitHub ownership proof is unavailable." }; }
  },
  async verifyIdentity({ externalIdentity }) { return externalIdentity ? { verified: true } : { verified: false, blocker: "Connect the GitHub identity that authored the contribution." }; },
  async buildEvidence({ snapshot: value }) { return { provider: "github", sourceUrl: value.objectUrl, state: "direct", contentHash: value.contentHash, payload: { sourceObjectId: value.sourceObjectId, merged: value.value === BigInt(1), observedAt: value.observedAt } }; },
};
