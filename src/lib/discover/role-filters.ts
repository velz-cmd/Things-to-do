import type { DiscoverAction, DiscoverActionKind } from "@/lib/discover/types";

/** Who is viewing Discover — tailors sections and primary actions. */
export type DiscoverRole =
  | "community"
  | "funder"
  | "founder"
  | "operator"
  | "dao"
  | "all";

const ROLE_ACTIONS: Record<DiscoverRole, DiscoverActionKind[] | "all"> = {
  community: ["claim", "share", "open", "install"],
  funder: ["fund", "sponsor"],
  founder: ["create_program", "install", "connect_sensor", "open", "analyze"],
  operator: ["install", "connect_sensor", "create_program", "open"],
  dao: ["fund", "sponsor", "create_program"],
  all: "all",
};

export const DISCOVER_ROLES: {
  id: DiscoverRole;
  label: string;
  hint: string;
}[] = [
  {
    id: "community",
    label: "Community",
    hint: "Claim value, connect sensors, explore creators",
  },
  {
    id: "funder",
    label: "Funder",
    hint: "Fulfill gaps and move capital where leverage is highest",
  },
  {
    id: "founder",
    label: "Founder",
    hint: "Install programs beside upstream tools you run",
  },
  {
    id: "operator",
    label: "Operator",
    hint: "Connect GitHub, Jellyfin, ListenBrainz — keep sensors healthy",
  },
  {
    id: "dao",
    label: "DAO",
    hint: "Grant pools, quadratic funding, treasury programs",
  },
  { id: "all", label: "All", hint: "Every surface and action" },
];

export type DiscoverSectionId =
  | "pulse"
  | "claim"
  | "bubblemap"
  | "trending"
  | "radars"
  | "liveFeed"
  | "opportunities"
  | "communities";

const ROLE_SECTIONS: Record<DiscoverRole, DiscoverSectionId[] | "all"> = {
  community: ["pulse", "claim", "trending", "radars", "liveFeed", "communities"],
  funder: ["pulse", "bubblemap", "trending", "opportunities", "liveFeed"],
  founder: ["pulse", "bubblemap", "trending", "radars", "opportunities", "communities"],
  operator: ["pulse", "radars", "liveFeed", "communities"],
  dao: ["pulse", "bubblemap", "trending", "radars", "opportunities", "liveFeed"],
  all: "all",
};

export function actionMatchesRole(action: DiscoverAction, role: DiscoverRole): boolean {
  if (role === "all") return true;
  const allowed = ROLE_ACTIONS[role];
  if (allowed === "all") return true;
  return allowed.includes(action.kind);
}

export function filterActionsByRole(actions: DiscoverAction[], role: DiscoverRole): DiscoverAction[] {
  if (role === "all") return actions;
  const filtered = actions.filter((a) => actionMatchesRole(a, role));
  return filtered.length ? filtered : actions.filter((a) => a.kind === "open");
}

export function sectionVisibleForRole(section: DiscoverSectionId, role: DiscoverRole): boolean {
  if (role === "all") return true;
  const allowed = ROLE_SECTIONS[role];
  if (allowed === "all") return true;
  return allowed.includes(section);
}

/** Default refresh cooldown per surface (ms) — staggered to reduce API pressure. */
export const SECTION_REFRESH_COOLDOWN_MS: Record<string, number> = {
  "network-pulse": 60_000,
  "trending-gaps": 90_000,
  "domain-radars": 120_000,
  "value-bubblemap": 120_000,
  "live-feed": 90_000,
  "opportunity-board": 180_000,
  "communities-strip": 180_000,
};
