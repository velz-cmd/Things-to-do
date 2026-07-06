import type { MissionBlueprintPayee } from "@/lib/mission/mission-blueprint-package";

/** Inline checkpoint copy: Fund $X → N authorizations clear. */
export function computeFundCheckpointLabel(input: {
  fundUsd: number;
  payees: MissionBlueprintPayee[];
  poolBalanceUsd?: number;
  milestoneUsd?: number;
}): { clearedCount: number; label: string; checkpointReached: boolean } {
  const { fundUsd, payees, poolBalanceUsd = 0, milestoneUsd = fundUsd } = input;
  const active = payees.filter((p) => p.owedUsd > 0);
  const totalOwed = active.reduce((s, p) => s + p.owedUsd, 0);

  let clearedCount = active.length;
  if (totalOwed > 0 && fundUsd < totalOwed) {
    let running = 0;
    clearedCount = 0;
    for (const p of active) {
      if (running + p.owedUsd <= fundUsd + 0.01) {
        running += p.owedUsd;
        clearedCount += 1;
      } else break;
    }
  }

  const poolAfter = poolBalanceUsd + fundUsd;
  const checkpointReached = poolAfter >= milestoneUsd;

  const label = checkpointReached
    ? `Fund $${fundUsd.toLocaleString()} → ${clearedCount} authorization${clearedCount === 1 ? "" : "s"} clear · checkpoint reached`
    : `Fund $${fundUsd.toLocaleString()} → ${clearedCount} authorization${clearedCount === 1 ? "" : "s"} clear`;

  return { clearedCount, label, checkpointReached };
}

export function formatAgentAttributionLine(
  chargedUsd: number,
  payeeCount: number,
  packageUsd: number,
  formatPrice: (n: number) => string,
): string {
  return `${formatPrice(chargedUsd)} → ${payeeCount} payee${payeeCount === 1 ? "" : "s"} → $${packageUsd.toLocaleString()} package`;
}
