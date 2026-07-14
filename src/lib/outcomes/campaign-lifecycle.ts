export type CampaignRuntimeAction = "pause" | "resume" | "close";

export function transitionCampaignRuntimeState(current: string, action: CampaignRuntimeAction): "active" | "paused" | "closed" | null {
  if (action === "pause" && current === "active") return "paused";
  if (action === "resume" && current === "paused") return "active";
  if (action === "close" && (current === "active" || current === "paused")) return "closed";
  return null;
}

export function calculateIncrementalUnits(current: bigint, previous: bigint): bigint {
  return current > previous ? current - previous : BigInt(0);
}
