import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { KNOWN_COMMUNITIES } from "@/lib/mission/community/detector";

/** Map mission topic labels to catalog slugs for pool / community APIs. */
export function resolveMissionCommunitySlug(input: {
  topicName?: string | null;
  scopeLabel?: string | null;
}): string | null {
  const haystack = [input.topicName, input.scopeLabel].filter(Boolean).join(" ").toLowerCase();
  if (!haystack.trim()) return null;

  for (const entry of COMMUNITY_CATALOG) {
    if (haystack.includes(entry.slug) || haystack.includes(entry.name.toLowerCase())) {
      return entry.slug;
    }
    if (entry.keywords.some((k) => haystack.includes(k.toLowerCase()))) {
      return entry.slug;
    }
  }

  for (const world of KNOWN_COMMUNITIES) {
    if (haystack.includes(world.name.toLowerCase())) {
      const catalog = COMMUNITY_CATALOG.find(
        (c) => c.name.toLowerCase() === world.name.toLowerCase(),
      );
      if (catalog) return catalog.slug;
      return world.name.toLowerCase().replace(/\s+/g, "-");
    }
    for (const alias of world.aliases) {
      if (haystack.includes(alias.toLowerCase())) {
        const catalog = COMMUNITY_CATALOG.find((c) =>
          c.keywords.some((k) => k.toLowerCase() === alias.toLowerCase()),
        );
        if (catalog) return catalog.slug;
      }
    }
  }

  return null;
}
