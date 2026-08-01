export const PAYOUT_DESTINATION_CHANGED_EVENT = "resolve.payout-destination.changed";

export function dispatchPayoutDestinationChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PAYOUT_DESTINATION_CHANGED_EVENT));
  }
}
