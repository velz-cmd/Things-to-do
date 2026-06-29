"use client";

import { LiveEventsList } from "@/components/resolve/events/live-events-list";

export function DiscoverLiveFeed({
  className,
  domain,
}: {
  className?: string;
  domain?: string | null;
}) {
  return (
    <LiveEventsList
      domain={domain ?? undefined}
      scope="network"
      limit={24}
      pollMs={20_000}
      className={className}
      title="Live activity"
      subtitle="Real authorizations and community events — no synthetic feed"
      emptyMessage="No live events yet. Install a community and connect sensors to see value flow here."
    />
  );
}
