import { createHash } from "crypto";
import type { MissionBlueprintPackage } from "@/lib/mission/mission-blueprint-package";

export type BlueprintSettlementRecipient = {
  label: string;
  amountUsd: number;
  walletStatus: "ready" | "claimable";
  source: string;
};

export type BlueprintSettlementPreview = {
  batchHash: string;
  proofHash: string;
  recipientCount: number;
  readyCount: number;
  pendingCount: number;
  totalUsd: number;
  treasuryUsd: number;
  recipients: BlueprintSettlementRecipient[];
  packageId: string;
  communitySlug: string;
  policy?: string;
};

export function buildBlueprintSettlementPreview(
  pkg: MissionBlueprintPackage,
): BlueprintSettlementPreview {
  const payeePayload = pkg.payees.map((p) => ({ label: p.label, usd: p.owedUsd }));
  const batchHash = createHash("sha256")
    .update(JSON.stringify(payeePayload))
    .digest("hex")
    .slice(0, 16);
  const proofHash = createHash("sha256")
    .update(JSON.stringify({ id: pkg.id, payees: payeePayload, policy: pkg.policy }))
    .digest("hex");

  const recipients: BlueprintSettlementRecipient[] = pkg.payees.map((p) => ({
    label: p.label,
    amountUsd: p.owedUsd,
    walletStatus:
      p.source.toLowerCase().includes("ledger") || p.source.toLowerCase().includes("authorization")
        ? "ready"
        : "claimable",
    source: p.source,
  }));

  const readyCount = recipients.filter((r) => r.walletStatus === "ready").length;
  const totalUsd = recipients.reduce((s, r) => s + r.amountUsd, 0);

  return {
    batchHash,
    proofHash,
    recipientCount: recipients.length,
    readyCount,
    pendingCount: recipients.length - readyCount,
    totalUsd,
    treasuryUsd: pkg.totalCapitalUsd,
    recipients,
    packageId: pkg.id,
    communitySlug: pkg.communitySlug,
    policy: pkg.policy,
  };
}
