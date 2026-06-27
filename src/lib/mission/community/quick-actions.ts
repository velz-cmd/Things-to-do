import type { CommunityKind } from "./types";
import type { CapabilityId } from "@/lib/mission/capabilities/types";

export type MissionQuickAction = {
  id: string;
  label: string;
  prompt: string;
  group?: string;
};

/** Elsa-style starter — three jobs RESOLVE performs. */
export const MISSION_JOB_STARTERS: Array<{ group: string; actions: MissionQuickAction[] }> = [
  {
    group: "Understand communities",
    actions: [
      { id: "react-health", label: "How healthy is React?", prompt: "How healthy is React? Contributors, maintainers, dependencies, treasury, governance, funding.", group: "Understand communities" },
      { id: "linux", label: "Help Linux", prompt: "Help Linux — kernel, GNOME, Fedora, funding gaps, maintainer risk", group: "Understand communities" },
      { id: "pakistan", label: "Pakistan OSS", prompt: "Help Pakistani open source — maintainers, universities, funding", group: "Understand communities" },
      { id: "compare", label: "Compare React vs Vue", prompt: "Compare React and Vue — contributors, funding, downstream risk", group: "Understand communities" },
    ],
  },
  {
    group: "Design capital",
    actions: [
      { id: "fund-1m", label: "We have $1M", prompt: "We have $1,000,000 — design a funding policy for our ecosystem", group: "Design capital" },
      { id: "fund-100k", label: "Deploy $100k", prompt: "I have $100,000 — design how capital should move across this community", group: "Design capital" },
      { id: "blueprint", label: "Capital Blueprint", prompt: "Generate a Capital Blueprint — who to fund, how much, how often, verification, settlement", group: "Design capital" },
      { id: "grant-prog", label: "Build grant program", prompt: "Build a grant program — eligibility, amounts, milestone verification", group: "Design capital" },
    ],
  },
  {
    group: "Execute & settle",
    actions: [
      { id: "dist-plan", label: "Create distribution plan", prompt: "Create a distribution plan — recipients, amounts, monthly streaming", group: "Execute & settle" },
      { id: "dao-prop", label: "Draft DAO proposal", prompt: "Draft a DAO treasury proposal for ecosystem funding", group: "Execute & settle" },
      { id: "settle", label: "Prepare settlement", prompt: "Walk me through exactly what capital would move and who receives it", group: "Execute & settle" },
      { id: "claim", label: "Claim earnings", prompt: "What value can I claim from my contributions?", group: "Execute & settle" },
    ],
  },
];

/** @deprecated use MISSION_JOB_STARTERS — kept for backward compat */
export const MISSION_STARTER_GROUPS = MISSION_JOB_STARTERS;

export function allStarterActions(): MissionQuickAction[] {
  return MISSION_STARTER_GROUPS.flatMap((g) => g.actions);
}

/** Contextual follow-up pills after a mission turn — like Elsa amount/route buttons. */
export function followUpQuickActions(input: {
  capability: CapabilityId;
  communityKind: CommunityKind;
  communityName?: string;
  capitalUsd?: number;
  hasOpportunities: boolean;
  claimableUsd?: number;
}): MissionQuickAction[] {
  const scope = input.communityName ?? "this community";
  const actions: MissionQuickAction[] = [];

  if (input.capitalUsd) {
    actions.push(
      { id: "sim-50", label: "Simulate $50k", prompt: `Simulate allocating $50,000 in ${scope}` },
      { id: "sim-all", label: `Deploy $${Math.round(input.capitalUsd / 1000)}k`, prompt: `Simulate allocating $${input.capitalUsd.toLocaleString()} in ${scope}` },
      { id: "philosophy", label: "Compare philosophies", prompt: "Compare Sustain Core vs Grow Ecosystem vs Balanced for this capital" },
    );
  }

  switch (input.capability) {
    case "discover_value_leaks":
      actions.push(
        { id: "rank", label: "Rank by impact", prompt: `Rank ${scope} by where capital matters most` },
        { id: "watch", label: "Watch changes", prompt: `What changed in ${scope} this week?` },
        { id: "plan", label: "Build funding plan", prompt: `Turn leaks in ${scope} into a capital plan` },
      );
      break;
    case "allocate_capital":
      actions.push(
        { id: "adjust", label: "Adjust weights", prompt: "Shift 10% from infrastructure to contributors — show outcome" },
        { id: "settle", label: "Review settlement", prompt: "Walk me through exactly what capital would move" },
      );
      break;
    case "compare_ecosystems":
      actions.push(
        { id: "fund-winner", label: "Who deserves more?", prompt: "Given this comparison, who deserves more capital?" },
        { id: "save", label: "Save comparison", prompt: "Save this comparison to mission memory" },
      );
      break;
    case "claim_value":
      if ((input.claimableUsd ?? 0) > 0) {
        actions.push(
          { id: "claim-now", label: `Claim $${Math.round(input.claimableUsd!)}`, prompt: "Walk me through claiming my recognized value" },
          { id: "breakdown", label: "Break down by community", prompt: "Break down claimable value by community" },
        );
      } else {
        actions.push(
          { id: "link-id", label: "Link identities", prompt: "Which identities should I link for attribution?", group: "Profile" },
        );
      }
      break;
    case "research_ecosystem":
    case "general_inquiry":
      actions.push(
        { id: "fund-here", label: "Who deserves funding?", prompt: `Who deserves funding in ${scope}?` },
        { id: "monitor", label: "Start monitoring", prompt: `What should I watch in ${scope}?` },
        { id: "deep", label: "Deeper research", prompt: `Research ${scope} in depth — communities, maintainers, grants` },
      );
      break;
    default:
      if (input.hasOpportunities) {
        actions.push(
          { id: "allocate", label: "Allocate capital", prompt: `Who deserves funding in ${scope}?` },
        );
      }
  }

  if (input.communityKind === "music") {
    actions.push(
      { id: "artists", label: "Top underpaid artists", prompt: "Which artists have listens but no patronage?" },
    );
  }
  if (input.communityKind === "local" || input.communityKind === "dao") {
    actions.push(
      { id: "oc-fund", label: "Open Collective treasuries", prompt: `Which Open Collective accounts fund ${scope}?` },
    );
  }

  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  }).slice(0, 6);
}

export function quickActionsForCommunity(
  kind: CommunityKind,
  name?: string,
): MissionQuickAction[] {
  const label = name ?? "this community";
  switch (kind) {
    case "music":
      return [
        { id: "m1", label: "Unpaid musicians", prompt: "Which musicians create value without fair pay?" },
        { id: "m2", label: "Listen attribution", prompt: `Map listen attribution gaps in ${label}` },
        { id: "m3", label: "Patronage plan", prompt: `Build a patronage plan for ${label}` },
      ];
    case "research":
      return [
        { id: "r1", label: "Grant gaps", prompt: `Which research groups in ${label} lack grant funding?` },
        { id: "r2", label: "Citation impact", prompt: `Map citation impact vs funding in ${label}` },
      ];
    case "local":
      return [
        { id: "l1", label: "Local maintainers", prompt: `Find maintainers and universities in ${label}` },
        { id: "l2", label: "Fund locally", prompt: `Build a local funding plan for ${label}` },
      ];
    default:
      return followUpQuickActions({
        capability: "general_inquiry",
        communityKind: kind,
        communityName: name,
        hasOpportunities: false,
      });
  }
}
