import { extractCommunityTargets, detectCommunityKind, KNOWN_COMMUNITIES } from "@/lib/mission/community/detector";
import type { CommunityKind } from "@/lib/mission/community/types";
import type { MissionReport } from "@/lib/mission/mission-report";

export type MissionTopic = {
  name: string;
  kind: CommunityKind;
};

export function resolveMissionTopic(input: {
  objective?: string | null;
  workspaceName?: string;
  report?: MissionReport;
}): MissionTopic | null {
  if (input.workspaceName) {
    return {
      name: input.workspaceName,
      kind: detectCommunityKind({ question: input.workspaceName, communityName: input.workspaceName }),
    };
  }

  const fromReport =
    input.report?.capitalBlueprint?.community ??
    input.report?.priority?.ecosystem;

  if (fromReport) {
    return {
      name: fromReport,
      kind: detectCommunityKind({ question: fromReport, communityName: fromReport }),
    };
  }

  const haystack = input.objective ?? input.report?.objective ?? "";
  if (!haystack.trim()) return null;

  const targets = extractCommunityTargets(haystack);
  if (targets.length > 0) {
    const name = targets[0]!;
    return { name, kind: detectCommunityKind({ question: haystack, communityName: name }) };
  }

  // "fund react", "help linux" — match known community tokens in the query
  const tokens = haystack.toLowerCase().split(/\s+/);
  for (const world of KNOWN_COMMUNITIES) {
    if (world.aliases.some((a) => tokens.includes(a.toLowerCase()))) {
      return { name: world.name, kind: world.kind };
    }
    if (tokens.includes(world.name.toLowerCase())) {
      return { name: world.name, kind: world.kind };
    }
  }

  // Capitalize first meaningful phrase if no known community matched
  const trimmed = haystack.trim();
  if (trimmed.length > 3 && trimmed.length < 48) {
    const kind = detectCommunityKind({ question: trimmed });
    if (kind !== "general") {
      return { name: trimmed.charAt(0).toUpperCase() + trimmed.slice(1, 40), kind };
    }
  }

  return null;
}
