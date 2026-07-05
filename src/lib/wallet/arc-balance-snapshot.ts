/**
 * Client-side last-known-good Arc balances — avoids flashing $0 when RPC hiccups.
 */
const STORAGE_KEY = "resolve.arc.balance.snapshot";

export type ArcBalanceSnapshot = {
  appOnChainUsd?: number;
  externalOnChainUsd?: number;
  appAddress?: string;
  externalAddress?: string;
  updatedAt: string;
};

function readStore(): ArcBalanceSnapshot {
  if (typeof window === "undefined") return { updatedAt: "" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { updatedAt: "" };
    return JSON.parse(raw) as ArcBalanceSnapshot;
  } catch {
    return { updatedAt: "" };
  }
}

function writeStore(next: ArcBalanceSnapshot) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

export function readArcBalanceSnapshot(): ArcBalanceSnapshot {
  return readStore();
}

export function mergeArcBalanceSnapshot(
  input: Partial<ArcBalanceSnapshot> & { allowZero?: boolean },
): ArcBalanceSnapshot {
  const prev = readStore();
  const next: ArcBalanceSnapshot = {
    appAddress: input.appAddress ?? prev.appAddress,
    externalAddress: input.externalAddress ?? prev.externalAddress,
    updatedAt: new Date().toISOString(),
  };

  const keep = (prevVal: number | undefined, nextVal: number | undefined) => {
    if (nextVal == null || !Number.isFinite(nextVal)) return prevVal;
    if (nextVal <= 0 && !input.allowZero && (prevVal ?? 0) > 0) return prevVal;
    return nextVal;
  };

  next.appOnChainUsd = keep(prev.appOnChainUsd, input.appOnChainUsd);
  next.externalOnChainUsd = keep(prev.externalOnChainUsd, input.externalOnChainUsd);
  writeStore(next);
  return next;
}

export function pickSnapshotUsd(
  kind: "app" | "external",
  snapshot: ArcBalanceSnapshot,
): number | null {
  const v = kind === "app" ? snapshot.appOnChainUsd : snapshot.externalOnChainUsd;
  return v != null && Number.isFinite(v) ? v : null;
}
