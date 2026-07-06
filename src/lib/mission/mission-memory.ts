import type { StoredMissionReceipt } from "@/lib/mission/server/mission-blueprint-receipts";

export function formatMissionMemoryLine(receipt: StoredMissionReceipt): string {
  const when = new Date(receipt.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const payees = receipt.package.payees.length;
  const usd = receipt.package.totalCapitalUsd;
  return `Last time you funded ${receipt.package.communityLabel} (${when}) — ${payees} payees · $${usd.toLocaleString()} · ${receipt.status}`;
}
