export function capitalBalanceUnavailable(input: {
  syncStatus: "live" | "cached" | "syncing" | "error" | "unknown" | "no_wallet";
  networkHealth: "healthy" | "degraded" | "unavailable" | "unknown";
  selectedBalancePresent: boolean;
}): boolean {
  return (
    !input.selectedBalancePresent ||
    input.syncStatus === "error" ||
    input.syncStatus === "unknown" ||
    input.syncStatus === "no_wallet" ||
    input.networkHealth === "unavailable"
  );
}
