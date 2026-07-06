import type { ProfileIdentityState } from "@/lib/profile/identity-types";
import type { IdentityPlatformId } from "@/lib/profile/community-identities";

/** Merge identity rows without downgrading a live connection to disconnected. */
export function mergeIdentityMaps(
  base: Map<IdentityPlatformId, ProfileIdentityState>,
  incoming: Iterable<ProfileIdentityState>,
  options?: { allowDisconnect?: boolean },
): Map<IdentityPlatformId, ProfileIdentityState> {
  const next = new Map(base);
  for (const row of incoming) {
    const prev = next.get(row.id);
    const connected =
      options?.allowDisconnect ? row.connected
      : prev?.connected && !row.connected ? true
      : row.connected;
    next.set(row.id, {
      ...prev,
      ...row,
      connected,
      displayValue: row.displayValue ?? prev?.displayValue,
      authorizeUrl: row.authorizeUrl ?? prev?.authorizeUrl,
      health: row.health ?? prev?.health,
    });
  }
  return next;
}
