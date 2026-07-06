/** Client-side fund action cache — instant badges before server refetch. */

import { dispatchPoolRefresh } from "@/lib/capital/refresh-events";

export type StoredFundAction = {
  id: string;
  programId: string;
  communitySlug?: string;
  templateId?: string;
  programName?: string;
  amountUsd: number;
  fundingSource: "app" | "external";
  txHash?: string;
  at: string;
};

const STORAGE_KEY = "resolve.fund.actions.v1";
const DISMISS_KEY = "resolve.fund.dismissed.v1";
export const FUND_ACTION_RECORDED_EVENT = "resolve.fund.recorded";
export const FUND_CARD_DISMISSED_EVENT = "resolve.fund.card.dismissed";

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

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDismissed(keys: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISS_KEY, JSON.stringify(keys.slice(0, 120)));
}

/** Stable key for a Discover value-receipt row. */
export function discoverCardKey(input: {
  communitySlug?: string;
  templateId?: string;
  gapId?: string;
}): string {
  return `${input.communitySlug ?? "unknown"}:${input.templateId ?? input.gapId ?? "row"}`;
}

export function dismissDiscoverCard(key: string) {
  const keys = readDismissed();
  if (!keys.includes(key)) {
    writeDismissed([key, ...keys]);
    window.dispatchEvent(new CustomEvent(FUND_CARD_DISMISSED_EVENT, { detail: { key } }));
  }
}

export function isDiscoverCardDismissed(key: string): boolean {
  return readDismissed().includes(key);
}

export function recordFundAction(
  action: Omit<StoredFundAction, "id" | "at"> & { id?: string },
) {
  const row: StoredFundAction = {
    id: action.id ?? `fund-${action.programId}-${Date.now()}`,
    at: new Date().toISOString(),
    ...action,
  };
  const prev = readAll().filter((r) => r.id !== row.id);
  writeAll([row, ...prev]);
  window.dispatchEvent(new CustomEvent(FUND_ACTION_RECORDED_EVENT, { detail: row }));
  dispatchPoolRefresh({ programId: row.programId, communitySlug: row.communitySlug });
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

export function totalFundedForCommunity(
  communitySlug: string,
  templateId?: string | null,
): number {
  return readAll()
    .filter(
      (r) =>
        r.communitySlug === communitySlug &&
        (!templateId || !r.templateId || r.templateId === templateId),
    )
    .reduce((s, r) => s + r.amountUsd, 0);
}

export function latestFundForProgram(programId: string): StoredFundAction | null {
  return readAll().find((r) => r.programId === programId) ?? null;
}

export function latestFundForCommunity(
  communitySlug: string,
  templateId?: string | null,
): StoredFundAction | null {
  return (
    readAll().find(
      (r) =>
        r.communitySlug === communitySlug &&
        (!templateId || !r.templateId || r.templateId === templateId),
    ) ?? null
  );
}
