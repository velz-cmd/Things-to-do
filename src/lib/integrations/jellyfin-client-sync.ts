"use client";

import {
  fetchJellyfinNowPlayingInBrowser,
  type JellyfinBrowserWatch,
} from "@/lib/integrations/jellyfin-browser";

const pushed = new Set<string>();

export async function pushJellyfinWatchesFromBrowser(creds: {
  url: string;
  accessToken: string;
  userId?: string;
}) {
  const playing = await fetchJellyfinNowPlayingInBrowser(creds.url, creds.accessToken);
  const now = new Date().toISOString();
  const watches = playing
    .filter((row) => {
      const key = `${row.itemId}:${row.sessionId}`;
      if (pushed.has(key)) return false;
      pushed.add(key);
      return true;
    })
    .map((row) => browserWatchToPayload(row, now));

  if (!watches.length) return { ingested: 0, watches: 0 };

  const res = await fetch("/api/connectors/jellyfin/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(
      creds.userId ? { userId: creds.userId, watches } : { watches },
    ),
  });
  const data = (await res.json()) as { error?: string; ingested?: number };
  if (!res.ok) throw new Error(data.error ?? "Jellyfin sync failed");
  return { ingested: data.ingested ?? 0, watches: watches.length };
}

function browserWatchToPayload(row: JellyfinBrowserWatch, watchedAt: string) {
  return {
    itemId: row.itemId,
    watchedAt,
    title: row.title,
    mediaType: row.mediaType,
    creatorName: row.creatorName,
    durationSec: row.durationSec,
  };
}
