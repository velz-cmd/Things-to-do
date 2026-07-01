import { programTemplatesForCommunity } from "../connectors/phase3-tracks";
import type { DiscoverAction } from "./types";

/** Default program template when creating from Discover community strip. */
export function defaultProgramTemplateForCommunity(slug: string): string {
  const templates = programTemplatesForCommunity(slug);
  return templates[0] ?? "user-centric-royalties";
}

export function communityStripActions(input: {
  slug: string;
  installed: boolean;
}): DiscoverAction[] {
  const actions: DiscoverAction[] = [
    {
      id: "open-console",
      label: "Open console",
      kind: "open",
      href: `/communities/${input.slug}#health`,
    },
  ];

  if (input.installed) {
    actions.push({
      id: "program",
      label: "Create program",
      kind: "create_program",
      communitySlug: input.slug,
      templateId: defaultProgramTemplateForCommunity(input.slug),
    });
  }

  return actions;
}
