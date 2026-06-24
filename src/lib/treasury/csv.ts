import type { DistributionEventInput } from "@/lib/gateway/types";

export function parseCsvEvents(csv: string): DistributionEventInput[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim());
  const events: DistributionEventInput[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const row: Record<string, string> = {};
    header.forEach((h, idx) => {
      row[h] = cols[idx]?.trim() ?? "";
    });

    let payload: Record<string, unknown> = {};
    try {
      payload = row.payload ? JSON.parse(row.payload) : {};
    } catch {
      payload = { raw: row.payload };
    }

    if (row.platformId) payload.platformId = row.platformId;
    if (row.exifArtist) payload.exifArtist = row.exifArtist;
    if (row.githubUsername) payload.githubUsername = row.githubUsername;
    if (row.demoVerified === "true") payload.demoVerified = true;

    events.push({
      eventId: row.eventId || `evt-${i}`,
      type: row.type || "scrobble_verified",
      platformId: row.platformId || undefined,
      amountUsd: parseFloat(row.amountUsd || "0"),
      payload,
    });
  }

  return events;
}
