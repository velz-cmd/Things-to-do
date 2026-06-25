import type { FounderIntent, GitHubPullRequest } from "@/lib/github/types";

const DOC_PATTERNS = /doc|readme|changelog|comment|typo|spelling|guide|tutorial/i;
const INFRA_PATTERNS = /refactor|perf|cache|ci|build|deps|dependenc|infra|architect|core|api|database|migration/i;
const COMMUNITY_PATTERNS = /community|i18n|locale|translation|ux|ui|design|accessibility|a11y/i;
const RESEARCH_PATTERNS = /research|experiment|benchmark|analysis|ml|ai|model/i;
const BUG_PATTERNS = /fix|bug|patch|hotfix|regression|crash|error/i;

export function normalizeFounderIntent(intent: Partial<FounderIntent>): FounderIntent {
  const raw = {
    infrastructure: intent.infrastructure ?? 50,
    documentation: intent.documentation ?? 20,
    community: intent.community ?? 20,
    research: intent.research ?? 5,
    bugfix: intent.bugfix ?? 5,
  };
  const total = Object.values(raw).reduce((s, v) => s + v, 0) || 100;
  return {
    infrastructure: Math.round((raw.infrastructure / total) * 100),
    documentation: Math.round((raw.documentation / total) * 100),
    community: Math.round((raw.community / total) * 100),
    research: Math.round((raw.research / total) * 100),
    bugfix: Math.round((raw.bugfix / total) * 100),
  };
}

/** Classify a PR into a founder-intent category from title, labels, and files. */
export function classifyPrCategory(pr: GitHubPullRequest): keyof FounderIntent {
  const text = `${pr.title} ${pr.labels.join(" ")} ${pr.files.map((f) => f.path).join(" ")}`;
  if (DOC_PATTERNS.test(text) || pr.files.some((f) => /\.(md|mdx|rst)$/i.test(f.path))) {
    return "documentation";
  }
  if (RESEARCH_PATTERNS.test(text)) return "research";
  if (COMMUNITY_PATTERNS.test(text)) return "community";
  if (BUG_PATTERNS.test(text)) return "bugfix";
  if (INFRA_PATTERNS.test(text)) return "infrastructure";
  return "infrastructure";
}

/** Apply founder priority multiplier to a base weight. */
export function applyIntentMultiplier(
  category: keyof FounderIntent,
  intent: FounderIntent,
  baseWeight: number,
): number {
  const priority = intent[category] / 100;
  const boost = 0.5 + priority * 1.5;
  return Math.round(baseWeight * boost);
}
