import { DEFAULT_FOUNDER_INTENT, type FounderIntent } from "@/lib/github/types";

export type FounderPresetId =
  | "balanced"
  | "infrastructure"
  | "growth"
  | "bugs"
  | "documentation"
  | "community";

export const FOUNDER_PRESETS: {
  id: FounderPresetId;
  label: string;
  description: string;
  intent: FounderIntent;
}[] = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Equal weight across impact types",
    intent: DEFAULT_FOUNDER_INTENT,
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    description: "Core systems, performance, reliability",
    intent: { infrastructure: 60, documentation: 12, community: 10, research: 10, bugfix: 8 },
  },
  {
    id: "growth",
    label: "Growth",
    description: "Adoption, outreach, ecosystem expansion",
    intent: { infrastructure: 18, documentation: 15, community: 42, research: 15, bugfix: 10 },
  },
  {
    id: "bugs",
    label: "Bug fixes",
    description: "Stability, patches, security",
    intent: { infrastructure: 12, documentation: 8, community: 10, research: 5, bugfix: 65 },
  },
  {
    id: "documentation",
    label: "Documentation",
    description: "Guides, API docs, onboarding",
    intent: { infrastructure: 12, documentation: 58, community: 18, research: 7, bugfix: 5 },
  },
  {
    id: "community",
    label: "Community",
    description: "Support, reviews, maintainer health",
    intent: { infrastructure: 12, documentation: 18, community: 55, research: 8, bugfix: 7 },
  },
];

export function intentForPreset(id: FounderPresetId): FounderIntent {
  return FOUNDER_PRESETS.find((p) => p.id === id)?.intent ?? DEFAULT_FOUNDER_INTENT;
}
