"use client";

import { SignalAuthorizationRails } from "@/components/resolve/signal-rails/signal-authorization-rails";

/** Discover — collapsed catalog teaser; actions live in Mission control. */
export function DiscoverAgentSignalMarket({
  signedIn,
  className,
}: {
  signedIn: boolean;
  className?: string;
}) {
  return (
    <SignalAuthorizationRails
      signedIn={signedIn}
      variant="discover"
      defaultExpanded={false}
      className={className}
    />
  );
}
