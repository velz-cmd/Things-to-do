import type { MissionBlueprintPackage } from "@/lib/mission/mission-blueprint-package";
import { simulateBlueprintPackage } from "@/lib/mission/mission-blueprint-package";
import type { BlueprintSettlementPreview } from "@/lib/mission/mission-blueprint-settlement";

export type MissionBlueprintExport = {
  exportedAt: string;
  product: "RESOLVE Mission Blueprint";
  version: 1;
  package: MissionBlueprintPackage;
  simulation: ReturnType<typeof simulateBlueprintPackage>;
  daoNote: string;
};

export type DaoProposalExport = {
  format: "snapshot" | "tally";
  version: 1;
  title: string;
  body: string;
  choices: string[];
  transfers: Array<{ recipient: string; amountUsd: number }>;
  proofHash?: string;
  batchHash?: string;
};

export function buildBlueprintExport(pkg: MissionBlueprintPackage): MissionBlueprintExport {
  return {
    exportedAt: new Date().toISOString(),
    product: "RESOLVE Mission Blueprint",
    version: 1,
    package: pkg,
    simulation: simulateBlueprintPackage(pkg),
    daoNote:
      "Share with board or DAO — payees, policy, and simulate totals before Arc authorize.",
  };
}

export function buildDaoProposalExport(
  pkg: MissionBlueprintPackage,
  settlement?: BlueprintSettlementPreview,
  format: "snapshot" | "tally" = "snapshot",
): DaoProposalExport {
  const sim = simulateBlueprintPackage(pkg);
  const transfers = pkg.payees.map((p) => ({ recipient: p.label, amountUsd: p.owedUsd }));
  const title = `Fund ${pkg.communityLabel} · $${pkg.totalCapitalUsd.toLocaleString()} allocation`;
  const body = [
    `RESOLVE Mission Blueprint — ${pkg.objective}`,
    ``,
    `Policy: ${pkg.policy ?? "balanced"}`,
    `Payees: ${pkg.payees.length} · $${sim.totalPayeeUsd.toFixed(2)} allocated`,
    settlement
      ? `Batch ${settlement.batchHash} · proof ${settlement.proofHash.slice(0, 12)}…`
      : null,
    ``,
    pkg.rationale,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    format,
    version: 1,
    title,
    body,
    choices: ["Approve allocation", "Request changes", "Abstain"],
    transfers,
    proofHash: settlement?.proofHash,
    batchHash: settlement?.batchHash,
  };
}

export function downloadBlueprintJson(pkg: MissionBlueprintPackage): void {
  const payload = buildBlueprintExport(pkg);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `resolve-blueprint-${pkg.communitySlug}-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadDaoProposal(
  pkg: MissionBlueprintPackage,
  settlement?: BlueprintSettlementPreview,
  format: "snapshot" | "tally" = "snapshot",
): void {
  const payload = buildDaoProposalExport(pkg, settlement, format);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `resolve-dao-proposal-${pkg.communitySlug}-${format}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
