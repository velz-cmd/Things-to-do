import type { LiveEventItem } from "../events/live";
import { isSettledEvent } from "../events/live-feed-labels";
import type { DiscoverAction } from "./types";

export function liveEventActions(item: LiveEventItem): DiscoverAction[] {
  const actions: DiscoverAction[] = [];
  const authId = item.id.startsWith("auth-") ? item.id.slice(5) : null;
  const receiptHref = authId ? `/receipt/${authId}` : undefined;
  const settled = isSettledEvent(item);

  if (item.entityPath) {
    actions.push({ id: "open", label: "Open", kind: "open", entityPath: item.entityPath });
  }

  if (item.status === "claimable") {
    actions.push({ id: "claim", label: "Claim", kind: "claim", href: "/claim" });
  } else if (item.status === "pending_funding" || item.status === "authorized") {
    actions.push({
      id: "fund",
      label: "Fund",
      kind: "fund",
      missionId: item.missionId,
      communitySlug: item.communitySlug,
      amountUsd: item.amountUsd,
    });
  } else if (settled && receiptHref) {
    actions.push({ id: "receipt", label: "View receipt", kind: "open", href: receiptHref });
  }

  if (item.communitySlug) {
    actions.push({
      id: "community",
      label: "Community",
      kind: "open",
      href: `/communities/${item.communitySlug}`,
    });
  }

  if (!actions.length) {
    actions.push({
      id: "explore",
      label: item.entityPath ? "Open entity" : "Explore Discover",
      kind: "open",
      entityPath: item.entityPath,
      href: item.entityPath ?? "/discover",
    });
  }

  return actions;
}

export function primaryLiveEventAction(item: LiveEventItem): DiscoverAction {
  const actions = liveEventActions(item);
  const authId = item.id.startsWith("auth-") ? item.id.slice(5) : null;

  if (isSettledEvent(item) && authId) {
    return { id: "receipt", label: "View receipt", kind: "open", href: `/receipt/${authId}` };
  }
  if (item.status === "claimable") {
    return actions.find((a) => a.kind === "claim") ?? actions[0];
  }
  if (item.status === "pending_funding" || item.status === "authorized") {
    return actions.find((a) => a.kind === "fund") ?? actions[0];
  }
  return actions[0];
}

export function receiptHrefForEvent(item: LiveEventItem): string | undefined {
  if (!isSettledEvent(item)) return undefined;
  const authId = item.id.startsWith("auth-") ? item.id.slice(5) : null;
  return authId ? `/receipt/${authId}` : undefined;
}
