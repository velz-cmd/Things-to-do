import type { ProgramEconomyConfig } from "./types";
import { defaultRepaymentConfig } from "./repayment-waterfall";

/** Parse / serialize economy config on ResolveProgram.metadataJson */
export function parseProgramEconomyConfig(
  metadataJson: string | null | undefined,
): ProgramEconomyConfig | null {
  if (!metadataJson?.trim()) return null;
  try {
    const raw = JSON.parse(metadataJson) as { economy?: ProgramEconomyConfig };
    return raw.economy ?? null;
  } catch {
    return null;
  }
}

export function mergeProgramEconomyConfig(
  metadataJson: string | null | undefined,
  patch: Partial<ProgramEconomyConfig>,
): string {
  let base: Record<string, unknown> = {};
  if (metadataJson?.trim()) {
    try {
      base = JSON.parse(metadataJson) as Record<string, unknown>;
    } catch {
      base = {};
    }
  }
  const existing = (base.economy as ProgramEconomyConfig | undefined) ?? {};
  base.economy = { ...existing, ...patch };
  return JSON.stringify(base);
}

export function defaultEconomyConfigForTemplate(
  templateId: string,
): ProgramEconomyConfig {
  const repaymentTemplates = new Set([
    "revenue-share-pool",
    "oss-maintainer-fund",
  ]);
  const riskTemplates = new Set(["dependency-insurance", "security-fund"]);

  let capitalMode: ProgramEconomyConfig["capitalMode"] = "impact";
  if (repaymentTemplates.has(templateId)) capitalMode = "repayment";
  if (riskTemplates.has(templateId)) capitalMode = "risk";

  const config: ProgramEconomyConfig = {
    templateId,
    capitalMode,
    engineIds: ["earn", "fund", "operate"],
    entryDoors: ["earn", "fund", "operate"],
  };

  if (capitalMode === "repayment") {
    config.repayment = defaultRepaymentConfig();
    config.engineIds.push("repayment");
  }
  if (capitalMode === "risk") {
    config.engineIds.push("risk");
    config.entryDoors.push("protect");
  }

  return config;
}
