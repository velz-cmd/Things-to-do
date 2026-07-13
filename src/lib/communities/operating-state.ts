export type CommunityOperatingState =
  | "not_installed"
  | "source_required"
  | "sync_required"
  | "policy_required"
  | "identity_review"
  | "obligation_review"
  | "simulation_required"
  | "capital_required"
  | "settlement_ready"
  | "operating";

export type CommunityOperatingFacts = {
  installed: boolean;
  sourceConnected: boolean;
  sourceHealthy: boolean;
  syncCompleted: boolean;
  programCount: number;
  unresolvedIdentityCount: number;
  obligationCount: number;
  simulationComplete: boolean;
  fundingGapUsd: number;
  settlementReady: boolean;
};

export function deriveCommunityOperatingState(
  facts: CommunityOperatingFacts,
): CommunityOperatingState {
  if (!facts.installed) return "not_installed";
  if (!facts.sourceConnected) return "source_required";
  if (!facts.sourceHealthy || !facts.syncCompleted) return "sync_required";
  if (facts.programCount === 0) return "policy_required";
  if (facts.unresolvedIdentityCount > 0) return "identity_review";
  if (facts.obligationCount > 0 && !facts.simulationComplete) return "simulation_required";
  if (facts.obligationCount > 0 && facts.fundingGapUsd > 0) return "capital_required";
  if (facts.obligationCount > 0 && !facts.settlementReady) return "obligation_review";
  if (facts.settlementReady) return "settlement_ready";
  return "operating";
}
