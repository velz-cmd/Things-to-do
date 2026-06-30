"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { SignalAuthorizationRails } from "@/components/resolve/signal-rails/signal-authorization-rails";

export function MissionSignalRailsPanel({
  onMissionPrompt,
}: {
  onMissionPrompt: (prompt: string, serviceId: string) => void;
}) {
  const { user } = useAuth();

  return (
    <SignalAuthorizationRails
      signedIn={Boolean(user)}
      variant="mission"
      defaultExpanded={false}
      onMissionPrompt={onMissionPrompt}
      className="mb-3"
    />
  );
}
