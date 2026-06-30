"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DiscoverAction } from "@/lib/discover/types";

export function useDiscoverActions(signedIn: boolean) {
  const router = useRouter();

  async function installCommunity(slug: string) {
    const res = await fetch(`/api/communities/${slug}/install`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Install failed");
    return data;
  }

  async function createProgram(slug: string, templateId?: string) {
    const res = await fetch(`/api/communities/${slug}/programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ templateId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not create program");
    return data;
  }

  async function fundProgram(programId: string, amountUsd = 25) {
    const res = await fetch("/api/capital/fund", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ programId, amountUsd }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Fund failed");
    return data;
  }

  async function runAction(action: DiscoverAction) {
    if (!signedIn && ["fund", "install", "create_program", "claim", "connect_sensor"].includes(action.kind)) {
      router.push(`/login?next=${encodeURIComponent("/discover")}`);
      return;
    }

    try {
      switch (action.kind) {
        case "open":
          if (action.entityPath) router.push(action.entityPath);
          else if (action.href) {
            if (action.href.startsWith("#")) {
              document.getElementById(action.href.slice(1))?.scrollIntoView({ behavior: "smooth" });
            } else router.push(action.href);
          }
          break;
        case "fund":
          if (action.programId) {
            await fundProgram(action.programId, action.amountUsd ?? 25);
            toast.success(`Funded $${(action.amountUsd ?? 25).toFixed(2)}`);
          } else if (action.href) {
            document.getElementById(action.href.replace("#", ""))?.scrollIntoView({ behavior: "smooth" });
          }
          break;
        case "install":
          if (!action.communitySlug) break;
          await installCommunity(action.communitySlug);
          toast.success(`Connected to ${action.communitySlug}`);
          router.push(`/communities/${action.communitySlug}`);
          break;
        case "create_program": {
          if (!action.communitySlug) break;
          try {
            await installCommunity(action.communitySlug);
          } catch {
            /* may already be installed */
          }
          const created = await createProgram(action.communitySlug, action.templateId);
          toast.success(`Program created — ${created.program?.name ?? "active"}`);
          router.push(`/communities/${action.communitySlug}`);
          break;
        }
        case "connect_sensor":
          router.push(action.href ?? `/communities/${action.communitySlug ?? "react"}`);
          break;
        case "claim":
          router.push(action.href ?? "/claim");
          break;
        case "sponsor":
        case "follow":
          if (action.programId) {
            document.getElementById("opportunities")?.scrollIntoView({ behavior: "smooth" });
          } else if (action.href) router.push(action.href);
          break;
        case "share":
          if (action.href) {
            await navigator.clipboard.writeText(`${window.location.origin}${action.href}`);
            toast.success("Receipt link copied");
          }
          break;
        case "analyze":
          if (action.entityPath) router.push(action.entityPath);
          break;
        default:
          if (action.href) router.push(action.href);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  }

  return { runAction, installCommunity, createProgram, fundProgram };
}
