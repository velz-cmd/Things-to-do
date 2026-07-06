"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useCommunityConsole } from "@/components/resolve/discover/discover-community-console-provider";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import type { AutomationTrigger } from "@/lib/automation/types";
import { dispatchProfileRefresh } from "@/lib/profile/refresh-events";

const VALID_TRIGGERS = new Set<AutomationTrigger>(["docs_merge", "play", "citation", "view"]);

/** Deep-link handler: /discover?community=slug&panel=automate opens the bubble operator panel. */
export function DiscoverUrlHandoff() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { open } = useCommunityConsole();
  const { refreshSync } = useUserConnections();
  const handled = useRef(false);
  const oauthHandled = useRef(false);

  useEffect(() => {
    const oauthKey = searchParams.toString();
    if (!oauthKey || oauthHandled.current) return;

    const githubConnected = searchParams.get("github_connected");
    const githubError = searchParams.get("github_error");
    const listenbrainzConnected = searchParams.get("listenbrainz_connected");
    const jellyfinConnected = searchParams.get("jellyfin_connected");

    if (
      !githubConnected &&
      !githubError &&
      !listenbrainzConnected &&
      !jellyfinConnected
    ) {
      return;
    }

    oauthHandled.current = true;

    void (async () => {
      if (githubConnected === "1") {
        toast.success("GitHub connected — Discover updated");
      } else if (githubError) {
        toast.error(`GitHub: ${githubError}`);
      } else if (listenbrainzConnected === "1") {
        toast.success("ListenBrainz connected");
      } else if (jellyfinConnected === "1") {
        toast.success("Jellyfin connected");
      }
      dispatchProfileRefresh();
      await refreshSync().catch(() => undefined);
      router.replace("/discover", { scroll: false });
    })();
  }, [searchParams, router, refreshSync]);

  useEffect(() => {
    if (handled.current) return;
    const community = searchParams.get("community");
    const panel = searchParams.get("panel");
    if (!community || panel !== "automate") return;

    handled.current = true;
    const rawTrigger = searchParams.get("trigger");
    const automationTrigger =
      rawTrigger && VALID_TRIGGERS.has(rawTrigger as AutomationTrigger)
        ? (rawTrigger as AutomationTrigger)
        : undefined;

    open({
      communitySlug: community,
      tab: "automate",
      actionContext: "automate",
      automationTrigger,
    });

    router.replace("/discover", { scroll: false });
  }, [searchParams, open, router]);

  return null;
}
