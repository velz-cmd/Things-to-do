import type { DiscoverAction, DiscoverActionKind, DiscoverIntent } from "@/lib/discover/types";

const INTENT_ACTIONS: Record<DiscoverIntent, DiscoverActionKind[] | "all"> = {
  earn: ["claim", "share"],
  fund: ["fund", "sponsor"],
  operate: ["install", "connect_sensor", "create_program"],
  build: ["create_program", "analyze", "open", "install"],
  sponsor: ["sponsor", "fund"],
  all: "all",
};

export const DISCOVER_INTENTS: { id: DiscoverIntent; label: string; hint: string }[] = [
  { id: "earn", label: "Earn", hint: "Claim royalties and share receipts" },
  { id: "fund", label: "Fund", hint: "Fulfill gaps and move capital" },
  { id: "operate", label: "Operate", hint: "Install communities and connect sensors" },
  { id: "build", label: "Build", hint: "Create programs and open entities" },
  { id: "sponsor", label: "Sponsor", hint: "Back programs with capital" },
  { id: "all", label: "All", hint: "Every action surface" },
];

export function actionMatchesIntent(action: DiscoverAction, intent: DiscoverIntent): boolean {
  if (intent === "all") return true;
  const allowed = INTENT_ACTIONS[intent];
  if (allowed === "all") return true;
  return allowed.includes(action.kind);
}

export function filterActionsByIntent(actions: DiscoverAction[], intent: DiscoverIntent): DiscoverAction[] {
  if (intent === "all") return actions;
  const filtered = actions.filter((a) => actionMatchesIntent(a, intent));
  return filtered.length ? filtered : actions.filter((a) => a.kind === "open");
}
