import { COMMUNITY_CATALOG, type ProgramTemplateId } from "@/lib/communities/catalog";
import { suggestedCommunitySlugForEntity } from "@/lib/entity/paths";

/** Known upstream org → RESOLVE community attach point. */
const OWNER_COMMUNITY: Record<string, string> = {
  navidrome: "navidrome",
  "immich-app": "jellyfin",
  jellyfin: "jellyfin",
  mastodon: "react",
  owncast: "jellyfin",
  vercel: "react",
  facebook: "react",
  supabase: "react",
  "langchain-ai": "react",
  koel: "independent-music",
};

function templateForKind(kind: string): ProgramTemplateId {
  if (kind === "music") return "user-centric-royalties";
  if (kind === "research") return "citation-toll";
  if (kind === "media") return "video-royalties";
  return "docs-bounty";
}

/** Map GitHub owner/repo to the best community + program template for Discover actions. */
export function resolveCommunityForRepo(
  owner: string,
  repo: string,
): { communitySlug: string; templateId: ProgramTemplateId } {
  const ownerLower = owner.toLowerCase();
  const repoLower = repo.toLowerCase();
  const full = `${ownerLower}/${repoLower}`;

  const aliasSlug = OWNER_COMMUNITY[ownerLower];
  if (aliasSlug) {
    const entry = COMMUNITY_CATALOG.find((c) => c.slug === aliasSlug);
    if (entry) {
      return { communitySlug: entry.slug, templateId: templateForKind(entry.kind) };
    }
  }

  const slugHit = COMMUNITY_CATALOG.find(
    (c) => c.slug === ownerLower || c.slug === repoLower,
  );
  if (slugHit) {
    return { communitySlug: slugHit.slug, templateId: templateForKind(slugHit.kind) };
  }

  for (const c of COMMUNITY_CATALOG) {
    const hit = c.keywords.some(
      (k) =>
        k === ownerLower ||
        k === repoLower ||
        k === full ||
        full.includes(k) ||
        ownerLower.includes(k) ||
        repoLower.includes(k),
    );
    if (hit) {
      return { communitySlug: c.slug, templateId: templateForKind(c.kind) };
    }
  }

  const fallback =
    suggestedCommunitySlugForEntity("repository") ?? "react";
  const entry = COMMUNITY_CATALOG.find((c) => c.slug === fallback);
  return {
    communitySlug: fallback,
    templateId: entry ? templateForKind(entry.kind) : "docs-bounty",
  };
}
