import type { ProgramTemplateId } from "@/lib/communities/catalog";

/** Phase 3 — three live connector tracks, same program core. */
export type Phase3TrackId = "music" | "oss" | "research" | "media";

export type Phase3Track = {
  id: Phase3TrackId;
  name: string;
  event: string;
  connector: string;
  programTemplate: ProgramTemplateId;
  communitySlugs: string[];
  description: string;
};

export const PHASE3_TRACKS: Phase3Track[] = [
  {
    id: "music",
    name: "Music",
    event: "scrobble.play",
    connector: "navidrome",
    programTemplate: "user-centric-royalties",
    communitySlugs: ["independent-music", "navidrome"],
    description: "ListenBrainz + Navidrome bridge — verified plays become authorizations",
  },
  {
    id: "oss",
    name: "Open source",
    event: "docs.merged",
    connector: "github",
    programTemplate: "docs-bounty",
    communitySlugs: ["react", "linux"],
    description: "GitHub sensor — merged docs PRs and security advisories",
  },
  {
    id: "research",
    name: "Research",
    event: "citation.verified",
    connector: "openalex",
    programTemplate: "citation-toll",
    communitySlugs: ["open-research"],
    description: "OpenAlex enrichment — verified citations become micropayment tolls",
  },
  {
    id: "media",
    name: "Video",
    event: "video.watch",
    connector: "jellyfin",
    programTemplate: "video-royalties",
    communitySlugs: ["jellyfin"],
    description: "Jellyfin sessions API — verified movie and episode watches",
  },
];

/** Program templates to activate per community install (not one wedge — parallel programs). */
export function programTemplatesForCommunity(communitySlug: string): ProgramTemplateId[] {
  switch (communitySlug) {
    case "linux":
      return ["docs-bounty", "security-fund"];
    case "react":
      return ["docs-bounty"];
    case "open-research":
      return ["citation-toll"];
    case "independent-music":
    case "navidrome":
      return ["user-centric-royalties"];
    case "jellyfin":
      return ["video-royalties"];
    default:
      return ["user-centric-royalties"];
  }
}

export function trackForCommunitySlug(slug: string): Phase3Track | undefined {
  return PHASE3_TRACKS.find((t) => t.communitySlugs.includes(slug));
}

export function communitiesForTrack(trackId: Phase3TrackId): string[] {
  return PHASE3_TRACKS.find((t) => t.id === trackId)?.communitySlugs ?? [];
}
