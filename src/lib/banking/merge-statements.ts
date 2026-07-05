import type { StoredFundAction } from "@/lib/capital/fund-action-store";
import type { StatementLine } from "@/lib/banking/types";

/** Union statement rows by id — prefer the newest timestamp when ids collide. */
export function mergeStatementLines(
  ...groups: StatementLine[][]
): StatementLine[] {
  const byId = new Map<string, StatementLine>();
  for (const group of groups) {
    for (const row of group) {
      const existing = byId.get(row.id);
      if (
        !existing ||
        new Date(row.at).getTime() >= new Date(existing.at).getTime()
      ) {
        byId.set(row.id, row);
      }
    }
  }
  return [...byId.values()]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 24);
}

export function fundActionToStatementLine(action: StoredFundAction): StatementLine {
  const label = action.programName
    ? `You funded ${action.programName}`
    : "You funded pool";
  return {
    id: action.id,
    at: action.at,
    type: "program_reserve",
    direction: "debit",
    amountUsd: action.amountUsd,
    balanceAfterUsd: null,
    label,
    reference: action.txHash ?? "completed",
  };
}

export function fundActionsToStatementLines(actions: StoredFundAction[]): StatementLine[] {
  return actions.map(fundActionToStatementLine);
}
