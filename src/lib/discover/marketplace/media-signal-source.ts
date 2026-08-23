import { createHash } from "node:crypto";
import {
  fetchListenBrainzListens,
  isListenBrainzConfigured,
  pingListenBrainz,
} from "@/lib/integrations/listenbrainz";
import { canonicalMediaId } from "@/lib/integrations/canonical-identity";
import { discoverNavigationAction } from "@/lib/discover/marketplace/action-contract";
import type {
  DiscoverSourceDiagnostic,
  MarketplaceOpportunity,
} from "@/lib/discover/marketplace/contracts";

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

/**
 * A URL/key-safe identity for this listen event. Delegates the "do we
 * have strong (MusicBrainz) identity, or only a weak title/artist match"
 * decision to the shared canonical-identity module; keeps its own
 * hash-based fallback format here since the shared module's fallback
 * isn't guaranteed URL-safe for use in a slug.
 */
function listenIdentity(input: {
  recordingMbid?: string;
  artistName: string;
  trackTitle: string;
  listenedAt: string;
}): string {
  const canonical = canonicalMediaId({
    recordingMbid: input.recordingMbid,
    artistName: input.artistName,
    trackTitle: input.trackTitle,
    observedAt: input.listenedAt,
  });
  if (canonical.strong) return input.recordingMbid!;
  return createHash("sha256")
    .update(`${input.artistName}:${input.trackTitle}:${input.listenedAt}`)
    .digest("hex")
    .slice(0, 16);
}

/**
 * Deterministic media uncertainty (Phase 4 parity with research's Part E).
 * Pure function, no network calls - a plain fact about what remains
 * unresolved, never an alarm.
 *
 * The only detectable category today: whether identity rests on a real
 * MusicBrainz recording ID or the weak artist/track/timestamp fallback -
 * two different recordings can share a title, so the fallback identity is
 * genuinely less certain. ListenBrainz is the only provider in this
 * pipeline, so there is no second source to cross-check against - unlike
 * research's Crossref/OpenAlex citation-count comparison, a
 * discrepancy-between-sources category does not exist here yet because
 * there is only one source.
 */
function mediaIdentityUncertainty(hasRecordingMbid: boolean): string | null {
  if (hasRecordingMbid) return null;
  return "No MusicBrainz recording ID is confirmed for this listen - identity is currently based on artist/track text and the exact observation timestamp, which two different recordings could coincidentally share.";
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
    const uncertainty = mediaIdentityUncertainty(Boolean(listen.recordingMbid));
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
      riskFlags: uncertainty ? [uncertainty] : [],
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
            classification: "observed",
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

/**
 * Real per-provider health for the media source, surfaced next to GitHub's
 * repository diagnostics instead of failing silently. `loadMediaSignals()`
 * itself must stay resilient (empty array on any failure, per its existing
 * contract with callers), so this is a separate live check - it never
 * blocks or changes what `loadMediaSignals()` returns.
 */
export async function loadMediaSourceDiagnostic(): Promise<DiscoverSourceDiagnostic | null> {
  if (!isListenBrainzConfigured()) return null;

  const result = await pingListenBrainz();
  const checkedAt = new Date().toISOString();
  return {
    id: "listenbrainz:account",
    provider: "listenbrainz",
    state: result.ok ? "connected" : "refresh_failed",
    evaluationPeriod: "Most recent verified listens",
    eventsInspected: null,
    acceptedEvents: 0,
    lastSuccessfulAt: result.ok ? checkedAt : null,
    reason: result.message,
    stale: !result.ok,
    primaryAction: discoverNavigationAction({
      id: "discover.open_external_record",
      label: result.ok ? "View on ListenBrainz" : "Review source status",
      href: result.ok ? "https://listenbrainz.org" : "/discover?view=activity",
    }),
    secondaryActions: [],
  };
}
