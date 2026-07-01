/** Human-facing copy — backend stays technical; UI explains why RESOLVE exists. */

import {
  RESOLVE_DOCTRINE,
  RESOLVE_EXISTENTIAL_THESIS,
  RESOLVE_SETTLEMENT_LINE,
  RESOLVE_WHY_PARAGRAPH,
} from "@/lib/discover/resolve-doctrine";

export {
  RESOLVE_DOCTRINE,
  RESOLVE_EXISTENTIAL_THESIS,
  RESOLVE_SETTLEMENT_LINE,
  RESOLVE_WHY_PARAGRAPH,
  RESOLVE_VALUE_CHAIN,
  RESOLVE_EMOTIONAL_HOOKS,
  RESOLVE_ROLE_TRANSFORMATIONS,
} from "@/lib/discover/resolve-doctrine";

export const VALUE_GRAPH_SUBTITLE =
  "Pick a node below — Fund & Sponsor settle real Arc USDC. Auto-pay rules wait for verified sensor proof.";

export const VALUE_GRAPH_MAP_HINT =
  "Map view shows how value connects. Use the horizontal cards for faster actions.";

export const VALUE_GRAPH_FOOTER =
  `Open source · attaches to communities you already run · ${RESOLVE_SETTLEMENT_LINE}`;

export const RESOLVE_WHY_ONE_LINER = RESOLVE_EXISTENTIAL_THESIS;

export type ConsoleActionWhy = {
  label: string;
  description: string;
  why: string;
};

export const CONSOLE_CREATE_ACTIONS: ConsoleActionWhy[] = [
  {
    label: "Pay maintainers",
    description: "Monthly retainer when merges land",
    why: "Millions use your package — merges should automatically become pay",
  },
  {
    label: "Open grant pool",
    description: "Quadratic match for your community",
    why: "Funders multiply every dollar where proof already exists",
  },
  {
    label: "Docs bounty",
    description: "Reward merged documentation PRs",
    why: "You merged docs — why shouldn't you automatically get paid?",
  },
  {
    label: "Invite operators",
    description: "Share install link",
    why: "Attach beside the tool you already run — no migration",
  },
  {
    label: "Watch health",
    description: "Sensors + live authorizations",
    why: "See proof before capital moves — economic memory compounds",
  },
  {
    label: "Test a rule",
    description: "Simulate spend before going live",
    why: "Policy executes when proof arrives — preview before going live",
  },
];

export const QUICK_ACTION_WHY: Record<string, string> = {
  fund: "Fund where the ledger shows a gap — no guessing",
  sponsor: "Verified events become programmable payments for creators",
  create_program: "Install a rail beside React or Navidrome — sensors prove work",
  open: "GitHub, Jellyfin, ListenBrainz already know — connect the payment layer",
  automate: "When proof arrives (merge, play, watch) — pay automatically up to your cap",
  install: "Attach to communities you already run — we don't replace your stack",
};

export function whyForNodeType(type: string): string {
  switch (type) {
    case "repository":
    case "ecosystem":
      return "OSS · millions use your package — merges and docs should automatically earn";
    case "community":
      return "Attach RESOLVE beside the community you already run";
    case "creator":
    case "person":
      return "Your work already creates value upstream — earn when sensors verify it";
    case "mission":
      return "Signals → proof → capital — Mission decides where money should move";
    case "treasury":
      return "Capital waiting to fulfill verified obligations";
    default:
      return RESOLVE_WHY_ONE_LINER;
  }
}
