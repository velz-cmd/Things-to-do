/**
 * Global ⌘K command registry — navigation + mission intents (Layer 6).
 */

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  href?: string;
  mission?: string;
  group: "navigate" | "mission" | "admin";
};

export const COMMAND_ITEMS: CommandItem[] = [
  { id: "nav-discover", label: "Discover", hint: "Where value exists", href: "/discover", group: "navigate", keywords: ["observe", "radar", "search"] },
  { id: "nav-mission", label: "Mission", hint: "Decide and simulate", href: "/mission", group: "navigate", keywords: ["workspace", "plan"] },
  { id: "nav-communities", label: "Communities", hint: "Operate programs", href: "/communities", group: "navigate", keywords: ["observatory", "deploy"] },
  { id: "nav-capital", label: "Capital", hint: "Treasury and claims", href: "/capital", group: "navigate", keywords: ["treasury", "payments", "settle"] },
  { id: "nav-profile", label: "Profile", hint: "Identity and earnings", href: "/profile", group: "navigate", keywords: ["account", "wallet"] },
  { id: "nav-claim", label: "Claim earnings", hint: "Creator collect", href: "/claim", group: "navigate", keywords: ["payout", "collect"] },
  { id: "nav-settings", label: "Settings", hint: "Connectors and keys", href: "/settings", group: "admin", keywords: ["api", "connectors", "webhooks"] },

  { id: "m-fund-react", label: "Fund React with 50,000 USDC", group: "mission", mission: "Fund React with 50,000 USDC", keywords: ["allocate", "grant"] },
  { id: "m-underpaid", label: "Find underpaid maintainers", group: "mission", mission: "Find underpaid maintainers in open source", keywords: ["gap", "leak"] },
  { id: "m-music", label: "Show my unpaid music plays", group: "mission", mission: "Show unpaid music plays and attribution gaps", keywords: ["navidrome", "royalty"] },
  { id: "m-k8s", label: "Analyze the Kubernetes ecosystem", group: "mission", mission: "Analyze the Kubernetes ecosystem funding and dependency risk", keywords: ["ecosystem", "risk"] },
  { id: "m-leak", label: "Show where value leaked this week", group: "mission", mission: "Show where value leaked this week across connected communities", keywords: ["entropy", "radar"] },
];

export function filterCommands(query: string): CommandItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMMAND_ITEMS;
  return COMMAND_ITEMS.filter((item) => {
    const hay = [item.label, item.hint ?? "", ...(item.keywords ?? [])].join(" ").toLowerCase();
    return hay.includes(q) || item.label.toLowerCase().startsWith(q);
  });
}
