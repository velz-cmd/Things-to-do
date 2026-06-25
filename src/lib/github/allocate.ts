import { runGithubPipeline } from "@/lib/github/pipeline";
import type { GitHubAllocationResult, FounderIntent } from "@/lib/github/types";

/** Allocation entry point — delegates to Evidence OS pipeline. */
export async function allocateGithubPool(input: {
  owner: string;
  repo: string;
  fundPoolUsd: number;
  evaluationDays?: number;
  founderIntent?: Partial<FounderIntent>;
  useLlm?: boolean;
}): Promise<GitHubAllocationResult | { error: string }> {
  const result = await runGithubPipeline(input);
  if ("error" in result) return result;
  return result.allocation;
}

export { runGithubPipeline };
