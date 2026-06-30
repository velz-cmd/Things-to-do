import { PROFIT_ENGINES } from "./engines";
import { ENTRY_DOORS } from "./entry-modes";
import { CAPITAL_MODES } from "./capital-modes";
import { ECONOMY_PROGRAM_TEMPLATES } from "./program-templates";
import { PLATFORM_REVENUE_STREAMS, getPlatformFeeWallet } from "./platform-revenue";
import { NETWORK_ARTIFACTS } from "./network-artifacts";
import {
  INFRASTRUCTURE_PHASES,
  VALUE_FLOW_STAGES,
  ACTOR_ENGINE_MATRIX,
  getCurrentPhaseFocus,
} from "./phases";
import { GOVERNANCE_PRINCIPLES } from "./governance";
import type { EconomicInfrastructureManifest } from "./types";

const MANIFEST_VERSION = "1.0.0";

export const ECONOMIC_THESIS =
  "RESOLVE is programmable economy infrastructure on Arc — anyone can earn, fund, operate, insure, repay, or build on top of value that already exists, with proof on every flow.";

export const ECONOMIC_POSITIONING =
  "Embedded payment infrastructure for communities and digital work — not a destination app. Stripe for programmable community economies.";

export function buildEconomicInfrastructureManifest(): EconomicInfrastructureManifest {
  const shippedEngines = PROFIT_ENGINES.filter((e) => e.shipped).length;
  const shippedTemplates = ECONOMY_PROGRAM_TEMPLATES.filter((t) => t.shipped).length;
  const shippedRevenue = PLATFORM_REVENUE_STREAMS.filter((s) => s.shipped).length;

  return {
    version: MANIFEST_VERSION,
    thesis: ECONOMIC_THESIS,
    positioning: ECONOMIC_POSITIONING,
    engines: PROFIT_ENGINES,
    entryDoors: ENTRY_DOORS,
    capitalModes: CAPITAL_MODES,
    programTemplates: ECONOMY_PROGRAM_TEMPLATES,
    platformRevenue: PLATFORM_REVENUE_STREAMS,
    networkArtifacts: NETWORK_ARTIFACTS,
    phases: INFRASTRUCTURE_PHASES,
    flow: VALUE_FLOW_STAGES,
    actorMatrix: ACTOR_ENGINE_MATRIX,
  };
}

export function buildInfrastructureSummary() {
  const phases = INFRASTRUCTURE_PHASES;
  return {
    manifestVersion: MANIFEST_VERSION,
    thesis: ECONOMIC_THESIS,
    engines: {
      total: PROFIT_ENGINES.length,
      shipped: PROFIT_ENGINES.filter((e) => e.shipped).length,
    },
    entryDoors: ENTRY_DOORS.length,
    capitalModes: {
      total: CAPITAL_MODES.length,
      shipped: CAPITAL_MODES.filter((m) => m.shipped).length,
    },
    programTemplates: {
      total: ECONOMY_PROGRAM_TEMPLATES.length,
      shipped: ECONOMY_PROGRAM_TEMPLATES.filter((t) => t.shipped).length,
    },
    platformRevenue: {
      total: PLATFORM_REVENUE_STREAMS.length,
      shipped: PLATFORM_REVENUE_STREAMS.filter((s) => s.shipped).length,
      feeWallet: getPlatformFeeWallet(),
    },
    phases: {
      complete: phases.filter((p) => p.status === "complete").length,
      inProgress: phases.filter((p) => p.status === "in_progress").length,
      planned: phases.filter((p) => p.status === "planned").length,
      focus: getCurrentPhaseFocus().map((p) => ({ id: p.id, name: p.name })),
    },
    governance: {
      principles: GOVERNANCE_PRINCIPLES,
      shipped: false,
    },
    productionDemoReady: true,
  };
}
