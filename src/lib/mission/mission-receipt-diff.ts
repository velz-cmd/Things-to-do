import type { MissionReportRecord } from "@/lib/mission/mission-report-store";

export type MissionReceiptDiff = {
  payeesAdded: string[];
  payeesRemoved: string[];
  payeesChanged: Array<{ label: string; beforeUsd: number; afterUsd: number }>;
  policyChanged: boolean;
  budgetDeltaUsd: number;
};

export function diffMissionReceipts(
  before: MissionReportRecord,
  after: MissionReportRecord,
): MissionReceiptDiff {
  const beforeMap = new Map(before.payees.map((p) => [p.label, p.owedUsd]));
  const afterMap = new Map(after.payees.map((p) => [p.label, p.owedUsd]));

  const payeesAdded = [...afterMap.keys()].filter((k) => !beforeMap.has(k));
  const payeesRemoved = [...beforeMap.keys()].filter((k) => !afterMap.has(k));
  const payeesChanged: MissionReceiptDiff["payeesChanged"] = [];

  for (const [label, afterUsd] of afterMap) {
    const beforeUsd = beforeMap.get(label);
    if (beforeUsd != null && Math.abs(beforeUsd - afterUsd) > 0.009) {
      payeesChanged.push({ label, beforeUsd, afterUsd });
    }
  }

  return {
    payeesAdded,
    payeesRemoved,
    payeesChanged,
    policyChanged: before.policy !== after.policy,
    budgetDeltaUsd: after.totalCapitalUsd - before.totalCapitalUsd,
  };
}
