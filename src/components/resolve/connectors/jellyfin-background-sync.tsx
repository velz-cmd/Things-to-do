"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { pushJellyfinWatchesFromBrowser } from "@/lib/integrations/jellyfin-client-sync";
import { loadJellyfinSession } from "@/lib/integrations/jellyfin-shared";

type JellyfinSyncConfig = {
  url: string;
  accessToken?: string;
  username?: string;
};

/** Polls Jellyfin from the user's browser while signed in — uses account password from session. */
export function JellyfinBackgroundSync() {
  const { user } = useAuth();
  const configRef = useRef<JellyfinSyncConfig | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadConfig() {
      const session = loadJellyfinSession();
      if (session) {
        configRef.current = session;
        return;
      }

      const res = await fetch("/api/profile/jellyfin-sync", { credentials: "include" });
      const data = (await res.json()) as {
        signedIn?: boolean;
        jellyfinSync?: JellyfinSyncConfig | null;
      };
      if (cancelled || !data.signedIn || !data.jellyfinSync?.url) {
        configRef.current = null;
        return;
      }
      configRef.current = data.jellyfinSync;
    }

    async function tick() {
      if (!configRef.current && !loadJellyfinSession()) return;
      try {
        await pushJellyfinWatchesFromBrowser();
      } catch {
        /* non-fatal background poll */
      }
    }

    void loadConfig().then(() => void tick());

    const configTimer = window.setInterval(() => void loadConfig(), 5 * 60_000);
    const syncTimer = window.setInterval(() => void tick(), 3 * 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(configTimer);
      window.clearInterval(syncTimer);
    };
  }, [user]);

  return null;
}
