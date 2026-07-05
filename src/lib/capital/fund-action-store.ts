/** Client-side fund action cache — instant badges before server refetch. */

import { dispatchCapitalRefresh } from "@/lib/capital/refresh-events";

export type StoredFundAction = {
  id: string;
  programId: string;
  communitySlug?: string;
  programName?: string;
  amountUsd: number;
  fundingSource: "app" | "external";
  txHash?: string;
  at: string;
};

const STORAGE_KEY = "resolve.fund.actions.v1";
export const FUND_ACTION_RECORDED_EVENT = "resolve.fund.recorded";

function readAll(): StoredFundAction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredFundAction[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(rows: StoredFundAction[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 80)));
}

export function recordFundAction(action: Omit<StoredFundAction, "id" | "at"> & { id?: string }) {
  const row: StoredFundAction = {
    id: action.id ?? `fund-${action.programId}-${Date.now()}`,
    at: new Date().toISOString(),
    ...action,
  };
  const prev = readAll().filter((r) => r.id !== row.id);
  writeAll([row, ...prev]);
  window.dispatchEvent(new CustomEvent(FUND_ACTION_RECORDED_EVENT, { detail: row }));
  dispatchCapitalRefresh({ reason: "fund" });
  return row;
}

export function listFundActions(): StoredFundAction[] {
  return readAll();
}

export function totalFundedForProgram(programId: string): number {
  return readAll()
    .filter((r) => r.programId === programId)
    .reduce((s, r) => s + r.amountUsd, 0);
}

export function latestFundForProgram(programId: string): StoredFundAction | null {
  return readAll().find((r) => r.programId === programId) ?? null;
}
