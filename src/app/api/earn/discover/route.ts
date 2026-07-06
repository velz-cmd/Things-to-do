import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { sanitizeConnectorIdentities } from "@/lib/identity/sanitize-profile";
import { getProfileEarningsSummary } from "@/lib/earn/summary";
import { resolveClaimIdentities } from "@/lib/identity/claim-identities";
import { listRecentEarnReceipts } from "@/lib/earn/recent-receipts";
import { EARN_ELIGIBILITY_RULES } from "@/lib/earn/eligibility-copy";
import { buildUserEligibleWork } from "@/lib/earn/user-eligible-work";
import { createClaimToken, claimUrlForToken } from "@/lib/claim/tokens";
import { getClaimableItemsForGithub } from "@/lib/identity/pending-rewards";
import { extractGithubIdentity } from "@/lib/identity/contributors";
import {
  userListenBrainzConfigured,
  userJellyfinConfigured,
} from "@/lib/profile/user-connections";
import { normalizeGithubLogin } from "@/lib/identity/github-login";
import { prisma } from "@/lib/db";

import type { DiscoverEarnConnector } from "@/lib/earn/discover-types";

async function musicbrainzLinked(walletAddress: string | null): Promise<{
  connected: boolean;
  displayValue?: string;
}> {
  if (!walletAddress || !process.env.DATABASE_URL) {
    return { connected: false };
  }
  try {
    const rows = await prisma.contributorRegistry.findMany({
      where: {
        walletAddress: walletAddress.toLowerCase(),
        exifArtist: { not: null },
        status: { in: ["linked", "verified"] },
      },
      take: 3,
      select: { exifArtist: true },
    });
    if (rows.length === 0) return { connected: false };
    const names = rows.map((r) => r.exifArtist).filter(Boolean) as string[];
    return {
      connected: true,
      displayValue: names.length === 1 ? names[0] : `${names.length} artist names`,
    };
  } catch {
    return { connected: false };
  }
}

/** Discover earn surface — ledger earnings, connectors, receipts, eligibility. */
export async function GET() {
  const authUser = await getSessionUser();

  if (!authUser) {
    return NextResponse.json({
      ok: true,
      signedIn: false,
      eligibility: EARN_ELIGIBILITY_RULES,
      workStreams: [],
      connectors: [
        {
          id: "github",
          label: "GitHub",
          connected: false,
          authorizeUrl: "/connect/github",
          hint: "Match OSS contributions to your payee key",
        },
        {
          id: "listenbrainz",
          label: "ListenBrainz",
          connected: false,
          authorizeUrl: "/connect/listenbrainz",
          hint: "Sync plays from any scrobbling app",
        },
        {
          id: "jellyfin",
          label: "Jellyfin",
          connected: false,
          authorizeUrl: "/connect/jellyfin",
          hint: "Credit video watches in funded programs",
        },
        {
          id: "musicbrainz",
          label: "MusicBrainz",
          connected: false,
          authorizeUrl: "/communities/navidrome",
          hint: "Link your artist name for play attribution",
        },
      ],
    });
  }

  try {
  let profile = await ensureProfileForUser(authUser);
  profile = await sanitizeConnectorIdentities(authUser.id, profile);

  const githubUsername = normalizeGithubLogin(profile.githubUsername);
  const listenbrainzConnected = userListenBrainzConfigured(profile);
  const jellyfinConnected = userJellyfinConfigured(profile);
  const walletAddress =
    profile.walletAddress?.toLowerCase() ?? profile.scanWalletAddress?.toLowerCase() ?? null;

  const [earnings, identities, mbLink, workStreams] = await Promise.all([
    getProfileEarningsSummary({ profile }).catch(() => null),
    resolveClaimIdentities({ profile }).catch(() => []),
    musicbrainzLinked(walletAddress),
    buildUserEligibleWork({ userId: authUser.id, profile }),
  ]);

  const recentReceipts =
    identities.length > 0
      ? await listRecentEarnReceipts(identities, 5).catch(() => [])
      : [];

  const connectors: DiscoverEarnConnector[] = [
    {
      id: "github",
      label: "GitHub",
      connected: Boolean(githubUsername),
      displayValue: githubUsername ? `@${githubUsername}` : undefined,
      authorizeUrl: "/connect/github",
      hint: githubUsername ? undefined : "Match OSS contributions to your payee key",
    },
    {
      id: "listenbrainz",
      label: "ListenBrainz",
      connected: listenbrainzConnected,
      displayValue:
        profile.listenbrainzUsername ? `@${profile.listenbrainzUsername}` : undefined,
      authorizeUrl: "/connect/listenbrainz",
      hint: listenbrainzConnected ? undefined : "Sync plays from any scrobbling app",
    },
    {
      id: "jellyfin",
      label: "Jellyfin",
      connected: jellyfinConnected,
      displayValue: profile.jellyfinUsername ? `@${profile.jellyfinUsername}` : undefined,
      authorizeUrl: "/connect/jellyfin",
      hint: jellyfinConnected ? undefined : "Credit video watches in funded programs",
    },
    {
      id: "musicbrainz",
      label: "MusicBrainz",
      connected: mbLink.connected,
      displayValue: mbLink.displayValue,
      authorizeUrl: "/communities/navidrome",
      hint: mbLink.connected ? undefined : "Link your artist identity for play attribution",
    },
  ];

  let claimUrl: string | null = null;
  if (earnings && earnings.claimableUsd > 0) {
    const { login } = extractGithubIdentity(authUser);
    const gh = login?.toLowerCase() ?? githubUsername;
    const primary =
      earnings.identities.find((i) => i.claimableUsd > 0) ?? earnings.identities[0];
    if (primary) {
      let authorizationIds: string[] = [];
      if (gh && primary.payeeKeyType === "github_username") {
        const items = await getClaimableItemsForGithub(gh);
        authorizationIds = items.authorizations.map((a) => a.id);
      }
      const token = createClaimToken({
        payeeKeyType: primary.payeeKeyType,
        payeeKey: primary.payeeKey,
        authorizationIds,
        amountUsd: earnings.claimableUsd,
      });
      claimUrl = claimUrlForToken(token);
    }
  }

  return NextResponse.json({
    ok: true,
    signedIn: true,
    earnings: earnings ?? undefined,
    connectors,
    recentReceipts,
    claimUrl,
    eligibility: EARN_ELIGIBILITY_RULES,
    workStreams: workStreams.filter((s) => s.meetsEligibility),
    identityCount: identities.length,
  });
  } catch (e) {
    console.error("[earn/discover]", e);
    return NextResponse.json({
      ok: true,
      signedIn: true,
      earnings: undefined,
      connectors: [],
      recentReceipts: [],
      claimUrl: null,
      eligibility: EARN_ELIGIBILITY_RULES,
      workStreams: [],
      degraded: true,
    });
  }
}
