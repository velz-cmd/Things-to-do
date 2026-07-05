/** Client event — capital balances or activity changed (fund, claim, distribute). */
export const CAPITAL_REFRESH_EVENT = "resolve.capital.refresh";

export type CapitalRefreshDetail = {
  reason?: "fund" | "claim" | "action" | "manual";
};

export function dispatchCapitalRefresh(detail?: CapitalRefreshDetail) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CAPITAL_REFRESH_EVENT, { detail }));
  }
}
