import type { ProgramRules } from "@/lib/communities/types";

/** Default pool funding milestones — real USD thresholds for batch unlock. */
export const DEFAULT_POOL_CHECKPOINT_THRESHOLDS_USD = [
  50, 100, 250, 500, 1000, 2500, 5000, 10000,
];

export function resolveCheckpointThresholds(rules: ProgramRules): number[] {
  const custom = rules.checkpointThresholdsUsd?.filter((n) => n > 0) ?? [];
  const base = custom.length > 0 ? custom : DEFAULT_POOL_CHECKPOINT_THRESHOLDS_USD;
  return [...new Set(base)].sort((a, b) => a - b);
}

export function payeeCategoryForTemplate(templateId: string): string {
  if (templateId.includes("royalt") || templateId === "user-centric-royalties") {
    return "artists";
  }
  if (templateId === "video-royalties") return "creators";
  if (templateId === "docs-bounty" || templateId === "security-fund") {
    return "maintainers";
  }
  if (templateId === "citation-toll") return "researchers";
  if (templateId === "quadratic-funding") return "hosted projects";
  return "contributors";
}
