import type { DiscoverAction } from "@/lib/discover/types";
import type { DiscoverRole } from "@/lib/discover/role-filters";

const FUNDER_KINDS = new Set<DiscoverAction["kind"]>(["fund", "sponsor", "share"]);
const FOUNDER_KINDS = new Set<DiscoverAction["kind"]>([
  "fund",
  "sponsor",
  "create_program",
  "console",
  "analyze",
  "open",
  "automate",
]);
const OPERATOR_KINDS = new Set<DiscoverAction["kind"]>([
  "connect_sensor",
  "analyze",
  "console",
  "create_program",
  "open",
  "automate",
]);
const COMMUNITY_KINDS = new Set<DiscoverAction["kind"]>(["claim", "open", "console", "fund"]);

/** Show only actions that match why the user picked their job/role. */
export function discoverActionsForRole(
  role: DiscoverRole,
  actions: DiscoverAction[],
): DiscoverAction[] {
  let allowed: Set<DiscoverAction["kind"]> | null = null;

  switch (role) {
    case "funder":
      allowed = FUNDER_KINDS;
      break;
    case "founder":
    case "dao":
      allowed = FOUNDER_KINDS;
      break;
    case "operator":
      allowed = OPERATOR_KINDS;
      break;
    case "community":
      allowed = COMMUNITY_KINDS;
      break;
    default:
      allowed = FUNDER_KINDS;
  }
  return actions.filter((a) => allowed!.has(a.kind));
}
