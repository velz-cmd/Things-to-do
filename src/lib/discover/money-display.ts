import type { DiscoverDataSource } from "@/lib/discover/types";

export type MoneyDisplay = {
  label: string;
  tone: "verified" | "not_synced" | "zero";
};

/** No-zero rule: never show fake $0 unless source returned zero. */
export function formatDiscoverMoney(
  amountUsd: number | null | undefined,
  verified: boolean,
  _source?: DiscoverDataSource,
): MoneyDisplay {
  if (!verified) {
    return { label: "Not synced", tone: "not_synced" };
  }
  if (amountUsd == null) {
    return { label: "No verified amount yet", tone: "not_synced" };
  }
  if (amountUsd === 0) {
    return { label: "$0 verified", tone: "zero" };
  }
  return { label: `$${amountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, tone: "verified" };
}
