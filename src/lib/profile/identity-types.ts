import type { IdentityPlatformId } from "@/lib/profile/community-identities";

export type ProfileIdentityState = {
  id: IdentityPlatformId;
  connected: boolean;
  displayValue?: string;
  hint?: string;
  health?: string;
  eventsToday?: number;
  authorizeUrl?: string;
};
