/** Client event — capital balances or activity changed (fund, claim, distribute). */
export const CAPITAL_REFRESH_EVENT = "resolve.capital.refresh";

/** Client event — program pool balances changed (fund, checkpoint settle). */
export const POOL_REFRESH_EVENT = "resolve.pool.refresh";

export type CapitalRefreshDetail = {
  reason?: "fund" | "claim" | "action" | "manual";
  programId?: string;
  communitySlug?: string;
};

export function dispatchCapitalRefresh(detail?: CapitalRefreshDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CAPITAL_REFRESH_EVENT, { detail }));
  }
}

export function dispatchPoolRefresh(detail?: { programId?: string; communitySlug?: string }) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(POOL_REFRESH_EVENT, { detail }));
  }
  dispatchCapitalRefresh({ reason: "fund", ...detail });
}
