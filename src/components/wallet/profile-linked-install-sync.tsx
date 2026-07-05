"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { communityLinkedViaProfile } from "@/lib/discover/community-profile-link";
import { apiInstallCommunity } from "@/lib/discover/discover-action-engine";
import { queryKeys } from "@/lib/query/keys";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";

/**
 * Silently creates community install rows when Profile already links upstream sources.
 * Keeps Communities/Discover fast without duplicate "Install RESOLVE" steps.
 */
export function ProfileLinkedInstallSync() {
  const { user } = useAuth();
  const { state: connections } = useUserConnections();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const inflightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !connections.signedIn) return;

    const activeSlug = pathname?.match(/^\/communities\/([^/?#]+)/)?.[1];
    const slugs = activeSlug
      ? [activeSlug]
      : COMMUNITY_CATALOG.filter((c) =>
          communityLinkedViaProfile(c.slug, connections),
        ).map((c) => c.slug);

    for (const slug of slugs) {
      if (connections.installedCommunitySlugs.includes(slug)) continue;
      if (!communityLinkedViaProfile(slug, connections)) continue;
      if (inflightRef.current.has(slug)) continue;

      inflightRef.current.add(slug);
      void apiInstallCommunity(slug)
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.communities });
          void queryClient.invalidateQueries({ queryKey: queryKeys.profileState });
        })
        .catch(() => {
          /* non-fatal — UI still treats profile link as ready */
        })
        .finally(() => {
          inflightRef.current.delete(slug);
        });
    }
  }, [user, connections, pathname, queryClient]);

  return null;
}
