"use client";

import {
  fetchJellyfinNowPlayingInBrowser,
  resolveJellyfinAccessToken,
  type JellyfinBrowserWatch,
} from "@/lib/integrations/jellyfin-browser";
import { loadJellyfinSession } from "@/lib/integrations/jellyfin-shared";

const pushed = new Set<string>();

export async function pushJellyfinWatchesFromBrowser(creds?: {
  url: string;
  accessToken?: string;
  username?: string;
  password?: string;
}) {
  const session = creds?.username && creds?.password ?
      {
        url: creds.url,
        username: creds.username,
        password: creds.password,
        accessToken: creds.accessToken,
      }
    : loadJellyfinSession();

  if (!session && !creds?.accessToken) {
    return { ingested: 0, watches: 0 };
  }

  const resolved =
    session ?
      await resolveJellyfinAccessToken(session)
    : { url: creds!.url, accessToken: creds!.accessToken! };

  const playing = await fetchJellyfinNowPlayingInBrowser(resolved.url, resolved.accessToken);
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
    body: JSON.stringify({ watches }),
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
