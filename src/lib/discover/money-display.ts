import type { DiscoverDataSource } from "@/lib/discover/types";

export type MoneyDisplay = {
  label: string;
  tone: "verified" | "estimate" | "not_synced" | "zero";
};

/** No-zero rule: never show fake $0 unless source returned zero. */
export function formatDiscoverMoney(
  amountUsd: number | null | undefined,
  verified: boolean,
  source?: DiscoverDataSource,
  amountKind?: "ledger" | "estimate",
): MoneyDisplay {
  const kind = amountKind ?? (verified ? "ledger" : "estimate");

  if (kind === "estimate" && amountUsd != null && amountUsd > 0) {
    return {
      label: `Est. $${amountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      tone: "estimate",
    };
  }

  if (!verified) {
    if (amountUsd != null && amountUsd > 0 && source === "github") {
      return {
        label: `Est. $${amountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        tone: "estimate",
      };
    }
    return { label: "Value provided · not settled", tone: "not_synced" };
  }
  if (amountUsd == null) {
    return { label: "No verified amount yet", tone: "not_synced" };
  }
  if (amountUsd === 0) {
    return { label: "$0 verified", tone: "zero" };
  }
  return { label: `$${amountUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, tone: "verified" };
}
