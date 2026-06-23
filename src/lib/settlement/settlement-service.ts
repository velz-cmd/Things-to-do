import { isLiveArcEnabled } from "@/lib/settlement/arc-config";
import { ArcLiveAdapter } from "@/lib/settlement/adapters/arc-live-adapter";
import { ArcMockAdapter } from "@/lib/settlement/adapters/arc-mock-adapter";
import type { SettlementAdapter } from "@/lib/settlement/settlement-types";

let adapter: SettlementAdapter | null = null;

export function getSettlementAdapter(): SettlementAdapter {
  if (!adapter) {
    adapter = isLiveArcEnabled() ? new ArcLiveAdapter() : new ArcMockAdapter();
  }
  return adapter;
}

export function resetSettlementAdapter() {
  adapter = null;
}

export async function getSettlementMode() {
  return isLiveArcEnabled() ? ("live_arc" as const) : ("mock_arc" as const);
}
