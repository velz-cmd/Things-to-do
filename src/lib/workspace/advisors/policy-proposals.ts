import type { WorkspaceEvidence } from "@/lib/workspace/context";
import type { FounderPresetId } from "@/lib/workspace/founder-presets";

export type PolicySplit = { label: string; percent: number };

export type PolicyProposal = {
  id: FounderPresetId | "custom";
  label: string;
  emoji: string;
  description: string;
  splits: PolicySplit[];
  evidenceNote: string;
};

const POLICY_TEMPLATES: Record<
  Exclude<PolicyProposal["id"], "custom">,
  { label: string; emoji: string; description: string; splits: PolicySplit[] }
> = {
  infrastructure: {
    label: "Sustain Core",
    emoji: "⚡",
    description: "Prioritize maintainers and infrastructure carrying critical activity.",
    splits: [
      { label: "Maintainers", percent: 40 },
      { label: "Infrastructure", percent: 25 },
      { label: "Security reserve", percent: 15 },
      { label: "Documentation", percent: 10 },
      { label: "Community", percent: 10 },
    ],
  },
  growth: {
    label: "Grow Ecosystem",
    emoji: "🚀",
    description: "Prioritize builders, docs, and community expansion.",
    splits: [
      { label: "Builders", percent: 30 },
      { label: "Documentation", percent: 20 },
      { label: "Community", percent: 25 },
      { label: "Tooling", percent: 15 },
      { label: "Reserve", percent: 10 },
    ],
  },
  balanced: {
    label: "Balanced",
    emoji: "⚖️",
    description: "Weighted across all value categories in your ledger.",
    splits: [
      { label: "Maintainers", percent: 25 },
      { label: "Contributors", percent: 25 },
      { label: "Documentation", percent: 15 },
      { label: "Community", percent: 15 },
      { label: "Research & music", percent: 20 },
    ],
  },
  bugs: {
    label: "Security Focus",
    emoji: "🛡️",
    description: "Bias toward stability, patches, and security reviewers.",
    splits: [
      { label: "Security", percent: 35 },
      { label: "Maintainers", percent: 30 },
      { label: "Bug fixes", percent: 20 },
      { label: "Reserve", percent: 15 },
    ],
  },
  documentation: {
    label: "Docs & Onboarding",
    emoji: "📚",
    description: "Fund documentation and guides driving downstream adoption.",
    splits: [
      { label: "Documentation", percent: 40 },
      { label: "Maintainers", percent: 25 },
      { label: "Community", percent: 20 },
      { label: "Tooling", percent: 15 },
    ],
  },
  community: {
    label: "Community Ops",
    emoji: "🌐",
    description: "Moderators, support, and community builders.",
    splits: [
      { label: "Moderators", percent: 30 },
      { label: "Community", percent: 30 },
      { label: "Maintainers", percent: 25 },
      { label: "Reserve", percent: 15 },
    ],
  },
};

/** Policy intents — suggestions only, nothing executes until user approves. */
export function buildPolicyProposals(evidence: WorkspaceEvidence): PolicyProposal[] {
  const participantCount = evidence.ledger?.count ?? 0;
  const treasury = evidence.treasury.balanceUsd;
  const note =
    participantCount > 0
      ? `Based on ${participantCount} recognized participants · $${treasury.toFixed(2)} USDC treasury`
      : treasury > 0
        ? `Treasury holds $${treasury.toFixed(2)} USDC — connect ecosystems to see participant evidence`
        : "Connect ecosystems and authorize value before distributing";

  const ids: Exclude<PolicyProposal["id"], "custom">[] = [
    "infrastructure",
    "growth",
    "balanced",
    "community",
  ];

  return [
    ...ids.map((id) => {
      const t = POLICY_TEMPLATES[id];
      return {
        id,
        label: t.label,
        emoji: t.emoji,
        description: t.description,
        splits: t.splits,
        evidenceNote: note,
      };
    }),
    {
      id: "custom",
      label: "Custom",
      emoji: "🛠️",
      description: "Define your own percentages — full manual control.",
      splits: [],
      evidenceNote: "Use manual allocation below or edit any proposed split.",
    },
  ];
}
