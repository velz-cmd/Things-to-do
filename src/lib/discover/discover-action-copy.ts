import { friendlyDiscoverActionLabel } from "@/lib/discover/discover-action-labels";
import { confirmNextStepHint } from "@/lib/discover/discover-action-outcomes";
import { automateHintFor } from "@/lib/discover/automate-action-labels";
import type { DiscoverAction } from "@/lib/discover/types";
import { communityReadyForDiscover } from "@/lib/discover/community-profile-link";
import type { UserConnectionState } from "@/lib/profile/connection-state-types";

export function discoverActionSummary(
  action: DiscoverAction,
  connections: UserConnectionState | null | undefined,
  walletUsd: number | null,
): { headline: string; requirement?: string } {
  const label = friendlyDiscoverActionLabel(action, connections);
  const slug = action.communitySlug;
  const connected = slug ? communityReadyForDiscover(slug, connections) : true;

  switch (action.kind) {
    case "fund":
    case "sponsor":
      return {
        headline: `${label} - USDC moves from your Arc wallet into this pool.`,
        requirement:
          walletUsd != null && walletUsd < 5
            ? "Wallet required: add Arc USDC in Capital."
            : undefined,
      };
    case "create_program":
      return {
        headline: `${label} — creates a payout rule on Arc and saves it to your account.`,
        requirement: connected ? undefined : "Connect the proof source in Profile first.",
      };
    case "install":
      return {
        headline: `${label} - starts a community program you can fund and settle.`,
      };
    case "analyze":
      return {
        headline: `${label} - reads activity from your connected proof source.`,
        requirement: connected ? undefined : "Connect the proof source in Profile first.",
      };
    case "connect_sensor":
      return {
        headline: "Connect once in Profile - syncs across Discover, Communities, and Capital.",
      };
    case "claim":
      return {
        headline: `${label} - requires identity proof linked in Profile.`,
      };
    case "share":
      return {
        headline: "Copy a verifiable settlement receipt link.",
      };
    case "automate":
      return {
        headline: automateHintFor({
          templateId: action.templateId,
          automationTrigger: action.automationTrigger,
        }),
        requirement: connected ? undefined : "Connect the proof source in Profile first.",
      };
    default:
      return { headline: label };
  }
}

export function discoverActionNextHint(action: DiscoverAction): string | undefined {
  return confirmNextStepHint(action);
}

/** Actions that mutate state and need confirm before POST /api/discover/actions. */
export function discoverActionNeedsConfirm(action: DiscoverAction): boolean {
  if (action.kind === "fund" || action.kind === "sponsor") {
    return Boolean(action.amountUsd && action.amountUsd >= 5 && action.programId);
  }
  return ["install", "create_program", "analyze", "automate", "claim", "share"].includes(action.kind);
}

/** Route through Discover API (not pure navigation). */
export function discoverActionUsesApi(action: DiscoverAction): boolean {
  return !["open", "console", "automate"].includes(action.kind);
}
