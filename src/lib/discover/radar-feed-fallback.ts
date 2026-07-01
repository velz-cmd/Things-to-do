import { emptyBundle } from "@/lib/discover/domain-radar-actions";
import type { DiscoverRadarFeedPayload } from "@/lib/discover/types";
import type { NetworkIntelligence } from "@/lib/workspace/intelligence";

/** Zero-state intelligence — pulse never blocks on null. */
export function emptyNetworkIntelligence(): NetworkIntelligence {
  return {
    recognizedUsd: 0,
    pendingFundingUsd: 0,
    claimableUsd: 0,
    settledUsd: 0,
    leakingUsd: 0,
    flowGapLabel: "Pending funding",
    treasuryBalanceUsd: 0,
    obligationsUsd: 0,
    topRisks: [],
    opportunitiesTracked: 0,
    criticalGaps: 0,
    sensorsOnline: 0,
    eventsToday: 0,
    headline: "Value discovery warming up — public programs and ledger rows appear as they rank",
  };
}

export function emptyRadarFeedPayload(
  partial?: Partial<DiscoverRadarFeedPayload>,
): DiscoverRadarFeedPayload {
  const domainRadars = partial?.domainRadars ?? {
    oss: emptyBundle("oss"),
    music: emptyBundle("music"),
    dao: emptyBundle("dao"),
  };

  return {
    ok: true,
    gaps: [],
    radars: { oss: [], music: [], dao: [] },
    domainRadars,
    emptyStates: [
      domainRadars.oss.emptyState,
      domainRadars.music.emptyState,
      domainRadars.dao.emptyState,
    ],
    intelligence: emptyNetworkIntelligence(),
    fundableCount: 0,
    ossSignalCount: 0,
    realSignalCount: 0,
    githubScanAt: null,
    claimHint: null,
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

export async function safeFeedPart<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.warn(`[discover/radar-feed] ${label} failed:`, e);
    return fallback;
  }
}
