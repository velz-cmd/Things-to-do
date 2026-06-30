import type { LiveEventItem } from "@/lib/events/live";

/** Discover live feed — human labels for economic heartbeat events. */
const EVENT_TYPE_LABELS: Record<string, string> = {
  "contribution.merge": "PR merged",
  "contribution.weighted": "Contribution recognized",
  "community_funded": "Program funded",
  "program_deployed": "Program funded",
  "qf.match": "Program funded",
  "claim_completed": "Claim created",
  "settlement_completed": "Arc settlement",
  "identity_linked": "Identity linked",
  "music_sync": "Identity linked",
  "sensor_sync": "Sensor connected",
  "community_installed": "Community installed",
  "scrobble.play": "Listen verified",
  "citation.verified": "Citation verified",
  "docs.merged": "Documentation merged",
};

const STATUS_LABELS: Record<string, string> = {
  settled: "Arc settlement",
  claimed: "Claim created",
  claimable: "Claim created",
  pending_funding: "Awaiting program funds",
  authorized: "Value authorized",
};

export function liveFeedEventLabel(item: Pick<LiveEventItem, "kind" | "title" | "status"> & {
  eventType?: string;
}): string {
  if (item.eventType && EVENT_TYPE_LABELS[item.eventType]) {
    return EVENT_TYPE_LABELS[item.eventType];
  }
  if (item.status && STATUS_LABELS[item.status]) {
    return STATUS_LABELS[item.status];
  }
  if (item.kind === "timeline" && item.title) {
    const lower = item.title.toLowerCase();
    if (lower.includes("fund")) return "Program funded";
    if (lower.includes("sensor") || lower.includes("sync")) return "Sensor connected";
    if (lower.includes("identity") || lower.includes("musicbrainz")) return "Identity linked";
    if (lower.includes("claim")) return "Claim created";
    if (lower.includes("settlement") || lower.includes("arc")) return "Arc settlement";
  }
  return item.title || "Value recognized";
}

export function isSettledEvent(item: Pick<LiveEventItem, "status">): boolean {
  return item.status === "settled" || item.status === "claimed";
}

/** UI chips may say "oss"; ledger domains use `code`. */
export function normalizeLiveEventDomain(domain: string | null | undefined): string | null {
  if (!domain || domain === "all") return null;
  if (domain === "oss") return "code";
  return domain;
}
