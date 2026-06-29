"use client";

import { LiveEventsList } from "@/components/resolve/events/live-events-list";

/** Auto-refreshing authorization feed for a community operating room. */
export function CommunityLiveAuthorizations({
  slug,
  pollMs = 30_000,
}: {
  slug: string;
  pollMs?: number;
}) {
  return (
    <LiveEventsList
      community={slug}
      limit={16}
      pollMs={pollMs}
      title="Live value events"
      subtitle="Authorizations from your sensors — refreshes automatically"
      emptyMessage="No authorizations yet. Connect sensors or run the scrobble bridge — plays and contributions appear here."
    />
  );
}
