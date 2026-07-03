/** Discover → Communities handoff intents */
export type CommunityIntent =
  | "fund"
  | "install"
  | "create_program"
  | "review_obligations"
  | "approve_payouts";

export function communityConsolePath(
  slug: string,
  intent?: CommunityIntent,
  options?: { tab?: "advanced" },
): string {
  const params = new URLSearchParams();
  if (intent) params.set("intent", intent);
  if (options?.tab === "advanced") params.set("tab", "advanced");
  const qs = params.toString();
  return qs ? `/communities/${slug}?${qs}` : `/communities/${slug}`;
}

/** Open Discover bubble operator panel — automate rules live on the value graph. */
export function discoverAutomatePath(
  communitySlug: string,
  options?: { trigger?: string },
): string {
  const params = new URLSearchParams();
  params.set("community", communitySlug);
  params.set("panel", "automate");
  if (options?.trigger) params.set("trigger", options.trigger);
  return `/discover?${params.toString()}`;
}

export function profileConnectPath(returnTo: string): string {
  return `/profile?next=${encodeURIComponent(returnTo)}`;
}

/** Section id to scroll when landing with ?intent= */
export const COMMUNITY_INTENT_ANCHOR: Record<CommunityIntent, string> = {
  fund: "programs",
  install: "console",
  create_program: "programs",
  review_obligations: "obligations",
  approve_payouts: "programs",
};
