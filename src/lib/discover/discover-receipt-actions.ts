import type { DiscoverAction, DiscoverActionKind } from "@/lib/discover/types";

/** Phase A — cosmetic / duplicate actions never shown on Discover primary surfaces. */
export const DISCOVER_HIDDEN_ACTION_KINDS: DiscoverActionKind[] = [
  "install",
  "create_program",
  "sponsor",
  "analyze",
  "automate",
  "share",
  "claim",
];

export const VALUE_RECEIPT_ACTION_LIMIT = 3;

const RECEIPT_ACTION_PRIORITY: DiscoverActionKind[] = [
  "fund",
  "connect_sensor",
  "open",
  "console",
];

function isProofOpenAction(action: DiscoverAction): boolean {
  if (action.kind !== "open") return false;
  const target = action.href ?? action.entityPath ?? "";
  return /\/receipt\//.test(target) || /proof/i.test(action.label);
}

/** Keep fund, connect, and proof-view only — max 3 slots. */
export function filterValueReceiptActions(actions: DiscoverAction[]): DiscoverAction[] {
  const seen = new Set<string>();
  const filtered = actions.filter((action) => {
    if (DISCOVER_HIDDEN_ACTION_KINDS.includes(action.kind)) return false;
    if (action.kind === "open" && !isProofOpenAction(action)) return false;
    return true;
  });

  const sorted = [...filtered].sort(
    (a, b) => RECEIPT_ACTION_PRIORITY.indexOf(a.kind) - RECEIPT_ACTION_PRIORITY.indexOf(b.kind),
  );

  const unique = sorted.filter((action) => {
    const key = `${action.kind}:${action.programId ?? ""}:${action.href ?? action.entityPath ?? action.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, VALUE_RECEIPT_ACTION_LIMIT);
}

/** Unified primary fund label on Discover. */
export function fulfillPoolLabel(_templateId?: string | null): string {
  return "Fulfill pool";
}

/** Secondary connect CTA when proof source is missing. */
export function connectSourceLabel(sourceName?: string): string {
  return sourceName ? `Connect ${sourceName}` : "Connect source";
}

/** Proof / receipt link label. */
export function viewProofLabel(): string {
  return "View proof";
}
