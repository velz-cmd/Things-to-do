import type { DiscoverAction, DiscoverActionKind } from "@/lib/discover/types";
import { stripCreatorClaimActions } from "@/lib/discover/need-types";

const ACTION_PRIORITY: DiscoverActionKind[] = [
  "fund",
  "sponsor",
  "install",
  "create_program",
  "claim",
  "console",
  "automate",
  "analyze",
  "connect_sensor",
  "open",
  "share",
];

/** Discover shows real actions on every card — job pills do not hide Fund / Attach. */
export function visibleDiscoverActions(
  actions: DiscoverAction[],
  surface: string,
): DiscoverAction[] {
  const funderLanes =
    surface === "trending-gaps" ||
    surface === "opportunity-queue" ||
    surface.startsWith("radar-") ||
    surface.startsWith("opportunity-board");

  const base = funderLanes ? stripCreatorClaimActions(actions) : actions;

  const seen = new Set<string>();
  const sorted = [...base].sort(
    (a, b) => ACTION_PRIORITY.indexOf(a.kind) - ACTION_PRIORITY.indexOf(b.kind),
  );

  const unique = sorted.filter((action) => {
    const key = `${action.kind}:${action.programId ?? ""}:${action.communitySlug ?? ""}:${action.href ?? action.entityPath ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, 6);
}
