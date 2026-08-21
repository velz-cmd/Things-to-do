import { createHash } from "node:crypto";
import {
  fetchListenBrainzListens,
  isListenBrainzConfigured,
} from "@/lib/integrations/listenbrainz";
import { discoverNavigationAction } from "@/lib/discover/marketplace/action-contract";
import type { MarketplaceOpportunity } from "@/lib/discover/marketplace/contracts";

/**
 * Real media-domain outcomes: individually verified plays observed on
 * ListenBrainz (RESOLVE's configured account, fed by Navidrome scrobbles).
 * Each item is one specific, timestamped listen event, not an aggregate.
 *
 * What this proves: this recording was verifiably played at this time, per
 * ListenBrainz's own ledger for this account.
 * What this does not prove: royalty amount, ownership of the recording,
 * global popularity, or economic value - a single verified listen is
 * evidence of playback, nothing more. No `funding` field is set here for
 * that reason, and no aggregate play count is invented.
 */
const MAX_LISTENS = 10;

function listenIdentity(input: {
  recordingMbid?: string;
  artistName: string;
  trackTitle: string;
  listenedAt: string;
}): string {
  if (input.recordingMbid) return input.recordingMbid;
  return createHash("sha256")
    .update(`${input.artistName}:${input.trackTitle}:${input.listenedAt}`)
    .digest("hex")
    .slice(0, 16);
}

export async function loadMediaSignals(): Promise<MarketplaceOpportunity[]> {
  if (!isListenBrainzConfigured()) return [];

  let listens;
  try {
    listens = await fetchListenBrainzListens(MAX_LISTENS);
  } catch {
    return [];
  }
  if (!listens.length) return [];

  return listens.map((listen): MarketplaceOpportunity => {
    const identity = listenIdentity(listen);
    return {
      id: `listenbrainz:${identity}`,
      slug: `listenbrainz-${identity}`,
      title: `"${listen.trackTitle}" by ${listen.artistName}`,
      summary: `Verified play recorded on ${new Date(listen.listenedAt).toISOString().slice(0, 10)}.`,
      description: `ListenBrainz recorded a verified play of "${listen.trackTitle}" by ${listen.artistName}. This is a single, timestamped playback observation - it does not by itself establish royalty amount, recording ownership, or overall popularity.`,
      type: "creator_collaboration",
      status: "confirmed",
      creator: {
        type: "individual",
        name: listen.artistName,
        verified: false,
      },
      skills: [],
      deliverables: [],
      evidenceRequirements: [],
      eligibility: [],
      provider: { preference: "open" },
      publishedAt: listen.listenedAt,
      updatedAt: listen.listenedAt,
      verificationStatus: "confirmed_external_record",
      riskFlags: [],
      source: { type: "listenbrainz_listen", id: identity },
      marketplaceKind: "verified_work",
      sourceUrl: `https://listenbrainz.org`,
      impactProfile: {
        measurable: true,
        signals: [
          {
            id: "listenbrainz_verified_listen",
            label: "Verified listen",
            value: "1",
            scope: "artifact",
            source: "ListenBrainz",
            observedAt: listen.listenedAt,
          },
        ],
      },
      entityState: {
        provenance: "external_integration",
        lifecycle: "confirmed",
        financialReadiness: "not_applicable",
      },
      primaryAction: discoverNavigationAction(
        {
          id: "discover.open_external_record",
          label: "View on ListenBrainz",
          href: "https://listenbrainz.org",
        },
        { target: "external", secondary: true },
      ),
      secondaryActions: [],
    };
  });
}
