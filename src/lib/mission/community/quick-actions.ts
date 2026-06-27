import type { CommunityKind } from "./types";
import type { CapabilityId } from "@/lib/mission/capabilities/types";

export type MissionQuickAction = {
  id: string;
  label: string;
  prompt: string;
  group?: string;
};

/** Elsa-style starter actions — community-first, not GitHub-first. */
export const MISSION_STARTER_GROUPS: Array<{ group: string; actions: MissionQuickAction[] }> = [
  {
    group: "Discover communities",
    actions: [
      { id: "ai-infra", label: "Communities powering AI", prompt: "Find communities silently powering AI infrastructure", group: "Discover communities" },
      { id: "linux", label: "Help Linux", prompt: "Help Linux — kernel, GNOME, Fedora, funding gaps", group: "Discover communities" },
      { id: "pakistan", label: "Pakistan OSS", prompt: "Help Pakistani open source — maintainers, universities, funding", group: "Discover communities" },
      { id: "digital-commons", label: "Digital commons", prompt: "Which digital commons communities deserve more capital?", group: "Discover communities" },
    ],
  },
  {
    group: "Capital & funding",
    actions: [
      { id: "fund-100k", label: "Deploy $100k", prompt: "I have $100,000 — who deserves funding based on observed impact?", group: "Capital & funding" },
      { id: "leaks", label: "Find value leaks", prompt: "Find value leaks across communities I'm observing", group: "Capital & funding" },
      { id: "compare", label: "Compare React vs Vue", prompt: "Compare React and Vue — who deserves more capital?", group: "Capital & funding" },
      { id: "risk", label: "Assess downstream risk", prompt: "Which community carries the most downstream dependency risk?", group: "Capital & funding" },
    ],
  },
  {
    group: "Music & creative",
    actions: [
      { id: "musicians-unpaid", label: "Unpaid musicians", prompt: "Which musicians are creating value but aren't getting paid?", group: "Music & creative" },
      { id: "independent-music", label: "Support indie music", prompt: "Support independent music — artists, listens, patronage gaps", group: "Music & creative" },
      { id: "royalties", label: "Listen royalties", prompt: "Map listen royalties and creative attribution gaps in music communities", group: "Music & creative" },
    ],
  },
  {
    group: "Research & education",
    actions: [
      { id: "research-fund", label: "Fund research", prompt: "Which research communities deserve funding based on citation impact?", group: "Research & education" },
      { id: "climate", label: "Climate research", prompt: "Climate research communities — grants, citations, funding gaps", group: "Research & education" },
      { id: "open-ed", label: "Open education", prompt: "Open education communities — who creates teaching value without fair pay?", group: "Research & education" },
    ],
  },
  {
    group: "Claims & settlement",
    actions: [
      { id: "claim", label: "Claim earnings", prompt: "What value can I claim from my contributions?", group: "Claims & settlement" },
      { id: "settle", label: "Review settlement", prompt: "Walk me through what capital would move and who receives it", group: "Claims & settlement" },
      { id: "treasury", label: "Treasury status", prompt: "What is treasury readiness for global settlement?", group: "Claims & settlement" },
    ],
  },
];

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
  if (input.communityKind === "research") {
    actions.push(
      { id: "citations", label: "Citation leaders", prompt: "Which research groups have high citations but low grant funding?" },
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
