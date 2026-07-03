"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCommunityConsole } from "@/components/resolve/discover/discover-community-console-provider";
import type { AutomationTrigger } from "@/lib/automation/types";

const VALID_TRIGGERS = new Set<AutomationTrigger>(["docs_merge", "play", "citation", "view"]);

/** Deep-link handler: /discover?community=slug&panel=automate opens the bubble operator panel. */
export function DiscoverUrlHandoff() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { open } = useCommunityConsole();
  const handled = useRef(false);

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
