import type { LiveEventItem } from "@/lib/events/live";

function normalizeDetail(detail: string): string {
  return detail.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Collapse repeated ledger rows — same repo + event type keeps newest only. */
export function dedupeLiveFeedEvents(events: LiveEventItem[]): LiveEventItem[] {
  const out: LiveEventItem[] = [];
  const seenAuth = new Set<string>();
  const seenTimeline = new Set<string>();

  for (const e of events) {
    if (e.kind === "authorization") {
      const key = [
        e.eventType ?? e.title,
        normalizeDetail(e.detail ?? ""),
        e.connectorId ?? "",
      ].join("|");
      if (seenAuth.has(key)) continue;
      seenAuth.add(key);
    } else if (e.kind === "timeline") {
      if (e.eventType === "mission_created") {
        const key = `${e.title}::${normalizeDetail(e.detail ?? "")}`;
        if (seenTimeline.has(key)) continue;
        seenTimeline.add(key);
      }
    }
    out.push(e);
  }

  return out;
}
