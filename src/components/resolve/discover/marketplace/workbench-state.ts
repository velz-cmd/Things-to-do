export function shouldOpenPayoutDestination(
  panel: string | null | undefined,
  signedIn: boolean,
) {
  return signedIn && panel === "payout_destination";
}
