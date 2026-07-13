import { isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { ArcLiveAdapter } from "@/lib/settlement/adapters/arc-live-adapter";
import { ArcMockAdapter } from "@/lib/settlement/adapters/arc-mock-adapter";
import type { SettlementAdapter } from "@/lib/settlement/settlement-types";
import { isDeputyDemoMode } from "@/lib/config/demo-mode";

let adapter: SettlementAdapter | null = null;

export function getSettlementAdapter(): SettlementAdapter {
  if (!adapter) {
    if (isLiveArcEnabled()) adapter = new ArcLiveAdapter();
    else if (isDeputyDemoMode()) adapter = new ArcMockAdapter();
    else throw new Error("Live Arc settlement is unavailable; no mock financial state was created.");
  }
  return adapter;
}

export function resetSettlementAdapter() {
  adapter = null;
}

export async function getSettlementMode() {
  if (isLiveArcEnabled()) return "live_arc" as const;
  if (isDeputyDemoMode()) return "mock_arc" as const;
  return "unavailable" as const;
}
