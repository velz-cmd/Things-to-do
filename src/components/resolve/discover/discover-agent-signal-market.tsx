"use client";

import { SignalAuthorizationRails } from "@/components/resolve/signal-rails/signal-authorization-rails";

/** Discover — full catalog; always expanded (no collapse). */
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
      defaultExpanded
      className={className}
    />
  );
}
