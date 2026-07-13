import type { ResolveActionId } from "@/lib/actions/types";
import {
  deriveCommunityOperatingState,
  type CommunityOperatingFacts,
  type CommunityOperatingState,
} from "@/lib/communities/operating-state";

export type CommunityNextBestAction = {
  state: CommunityOperatingState;
  actionId: ResolveActionId;
  label: string;
  reason: string;
  expectedResult: string;
  destination: "communities" | "mission" | "capital" | "profile";
  blockedReason?: string;
  recoveryActionId?: ResolveActionId;
};

const ACTIONS: Record<CommunityOperatingState, Omit<CommunityNextBestAction, "state">> = {
  not_installed: {
    actionId: "community.install",
    label: "Install ecosystem",
    reason: "RESOLVE must be installed before it can operate sources, policy, and obligations.",
    expectedResult: "A persistent community console is created for this account.",
    destination: "communities",
  },
  source_required: {
    actionId: "source.connect",
    label: "Connect source",
    reason: "No evidence identity is connected for this ecosystem.",
    expectedResult: "Verified source activity can enter the community operating loop.",
    destination: "profile",
  },
  sync_required: {
    actionId: "source.sync",
    label: "Synchronize source",
    reason: "The source is connected but has not produced a healthy completed synchronization.",
    expectedResult: "Fresh evidence and observed identities become available for policy evaluation.",
    destination: "communities",
    recoveryActionId: "source.reconnect",
  },
  policy_required: {
    actionId: "program.create_draft",
    label: "Create program",
    reason: "Evidence is available, but no policy converts it into recognized obligations.",
    expectedResult: "A versioned draft policy can be reviewed and simulated.",
    destination: "communities",
  },
  identity_review: {
    actionId: "identity.confirm_match",
    label: "Open Identity Desk",
    reason: "One or more observed payees do not have a confirmed payout identity.",
    expectedResult: "Eligible obligations can reference a verified payout destination.",
    destination: "communities",
    recoveryActionId: "identity.submit_proof",
  },
  obligation_review: {
    actionId: "obligation.review",
    label: "Review obligations",
    reason: "Recognized obligations still require operational review.",
    expectedResult: "Evidence, policy, and payee rows are ready for settlement preparation.",
    destination: "communities",
  },
  simulation_required: {
    actionId: "mission.simulate",
    label: "Run simulation",
    reason: "The current policy has recognized obligations but no persisted simulation result.",
    expectedResult: "Funding and payee effects are visible before authorization.",
    destination: "mission",
    recoveryActionId: "mission.generate_blueprint",
  },
  capital_required: {
    actionId: "capital.open_funding",
    label: "Open Capital",
    reason: "The prepared obligations exceed available program capital.",
    expectedResult: "The exact funding requirement opens with community context preserved.",
    destination: "capital",
  },
  settlement_ready: {
    actionId: "obligation.prepare_settlement",
    label: "Review authorization",
    reason: "Evidence, identity, policy, simulation, and capital checks are complete.",
    expectedResult: "Capital receives a complete settlement package without rebuilding the decision.",
    destination: "capital",
  },
  operating: {
    actionId: "source.view_status",
    label: "Open Sources",
    reason: "No obligation currently needs intervention.",
    expectedResult: "The next evidence cycle and connector health remain visible.",
    destination: "communities",
  },
};

export function getCommunityNextBestAction(
  facts: CommunityOperatingFacts,
): CommunityNextBestAction {
  const state = deriveCommunityOperatingState(facts);
  return { state, ...ACTIONS[state] };
}
