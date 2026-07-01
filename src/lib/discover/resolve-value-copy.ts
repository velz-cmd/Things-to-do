/** Human-facing copy — backend stays technical; UI explains why RESOLVE exists. */

export const VALUE_GRAPH_SUBTITLE =
  "Verified value between communities, creators, and programs — click a bubble to move money or install a rail.";

export const VALUE_GRAPH_FOOTER =
  "Open source · attaches to communities you already run · Circle settles on Arc";

export const RESOLVE_WHY_ONE_LINER =
  "We record what is owed when work happens, then route capital from funders to creators — no new platform to join.";

export type ConsoleActionWhy = {
  label: string;
  description: string;
  why: string;
};

export const CONSOLE_CREATE_ACTIONS: ConsoleActionWhy[] = [
  {
    label: "Pay maintainers",
    description: "Monthly retainer when merges land",
    why: "Founders keep builders paid without manual spreadsheets",
  },
  {
    label: "Open grant pool",
    description: "Quadratic match for your community",
    why: "Funders multiply every dollar — DAOs and patrons share leverage",
  },
  {
    label: "Docs bounty",
    description: "Reward merged documentation PRs",
    why: "OSS builders earn when GitHub sensor proves the merge",
  },
  {
    label: "Invite operators",
    description: "Share install link",
    why: "Grow the community that already uses your upstream tool",
  },
  {
    label: "Watch health",
    description: "Sensors + live authorizations",
    why: "Operators see proof before money moves — no blind funding",
  },
  {
    label: "Test a rule",
    description: "Simulate spend before going live",
    why: "Founders preview payroll or bounties without risking capital",
  },
];

export const QUICK_ACTION_WHY: Record<string, string> = {
  fund: "Funder: clear pending obligations where proof already exists",
  sponsor: "Back this community program — creators earn on verified events",
  create_program: "Founder: install an RFB rail beside the tool you already run",
  open: "Operator: connect GitHub, Jellyfin, or ListenBrainz — value starts at the sensor",
  automate: "Set a rule so authorizations settle without another click",
  install: "Attach RESOLVE to an existing community — we do not replace your stack",
};

export function whyForNodeType(type: string): string {
  switch (type) {
    case "repository":
    case "ecosystem":
      return "OSS · fund docs, security, and maintainer work where GitHub proves impact";
    case "community":
      return "Existing community · install programs without migrating members";
    case "creator":
    case "person":
      return "Creator or maintainer · earn when sensors verify your contribution";
    case "mission":
      return "Program · capital flows here when authorizations clear";
    case "treasury":
      return "Treasury · pooled capital waiting to fulfill verified obligations";
    default:
      return RESOLVE_WHY_ONE_LINER;
  }
}
