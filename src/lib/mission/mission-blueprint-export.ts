import type { MissionBlueprintPackage } from "@/lib/mission/mission-blueprint-package";
import { simulateBlueprintPackage } from "@/lib/mission/mission-blueprint-package";

export type MissionBlueprintExport = {
  exportedAt: string;
  product: "RESOLVE Mission Blueprint";
  version: 1;
  package: MissionBlueprintPackage;
  simulation: ReturnType<typeof simulateBlueprintPackage>;
  daoNote: string;
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
