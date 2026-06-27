/** Which open-community each identity platform belongs to. */
export type CommunityKind =
  | "open_source"
  | "music"
  | "settlement"
  | "fediverse"
  | "video";

export type IdentityPlatformId =
  | "email"
  | "github"
  | "wallet"
  | "listenbrainz"
  | "navidrome"
  | "gmail"
  | "mastodon"
  | "peertube";

export type IdentityPlatformDef = {
  id: IdentityPlatformId;
  community: CommunityKind;
  communityLabel: string;
  platform: string;
  description: string;
  status: "live" | "upcoming";
  /** Where payouts or attribution flow in RESOLVE */
  usedFor: string;
};

export const COMMUNITY_LABELS: Record<CommunityKind, string> = {
  open_source: "Open source & code",
  music: "Music & creative work",
  settlement: "Settlement & payouts",
  fediverse: "Fediverse & social",
  video: "Video & streaming",
};

export const IDENTITY_PLATFORMS: IdentityPlatformDef[] = [
  {
    id: "github",
    community: "open_source",
    communityLabel: COMMUNITY_LABELS.open_source,
    platform: "GitHub",
    description: "Link your contributor identity to claim authorizations and receive maintainer payouts.",
    status: "live",
    usedFor: "Code attribution · maintainer claims",
  },
  {
    id: "navidrome",
    community: "music",
    communityLabel: COMMUNITY_LABELS.music,
    platform: "Navidrome",
    description: "Self-hosted music library — scrobbles map to MusicBrainz credits and per-listen attribution.",
    status: "live",
    usedFor: "Creative attribution · listen royalties",
  },
  {
    id: "listenbrainz",
    community: "music",
    communityLabel: COMMUNITY_LABELS.music,
    platform: "ListenBrainz",
    description: "Open scrobble history tied to MusicBrainz — RESOLVE reads listens for creative payouts.",
    status: "live",
    usedFor: "MusicBrainz identity · scrobble sync",
  },
  {
    id: "wallet",
    community: "settlement",
    communityLabel: COMMUNITY_LABELS.settlement,
    platform: "Arc wallet",
    description: "Receive USDC settlements and claim authorized earnings on Arc testnet.",
    status: "live",
    usedFor: "Payout destination · on-chain claims",
  },
  {
    id: "gmail",
    community: "open_source",
    communityLabel: COMMUNITY_LABELS.open_source,
    platform: "Gmail",
    description: "Optional — connect inbox for receipt-based claim evidence (refunds, subscriptions).",
    status: "live",
    usedFor: "Claim evidence · not required for GitHub",
  },
  {
    id: "mastodon",
    community: "fediverse",
    communityLabel: COMMUNITY_LABELS.fediverse,
    platform: "Mastodon",
    description: "ActivityPub identity for fediverse communities — attribution from public posts.",
    status: "upcoming",
    usedFor: "Social attribution",
  },
  {
    id: "peertube",
    community: "video",
    communityLabel: COMMUNITY_LABELS.video,
    platform: "PeerTube",
    description: "Video instance plugin — viewer presence and creator payouts.",
    status: "upcoming",
    usedFor: "Video attribution",
  },
];

export function platformsByCommunity(): Map<CommunityKind, IdentityPlatformDef[]> {
  const map = new Map<CommunityKind, IdentityPlatformDef[]>();
  for (const p of IDENTITY_PLATFORMS) {
    const list = map.get(p.community) ?? [];
    list.push(p);
    map.set(p.community, list);
  }
  return map;
}
