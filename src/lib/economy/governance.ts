import type {
  DaoProposalStatus,
  GovernanceProposal,
  GovernanceVoteWeight,
} from "./governance-types";

export type {
  DaoProposalStatus,
  GovernanceProposal,
  GovernanceVoteWeight,
} from "./governance-types";

/** DAO infrastructure schema — Phase adv-8 (types only; DB binding next) */
export const GOVERNANCE_PRINCIPLES = [
  "Governance chooses policy and budget; RESOLVE executes rules on the ledger",
  "Votes do not pick individual payees — sensors authorize at event time",
  "QF-weight for community members; capital-weight for funding decisions only",
  "Approved proposals update program rulesJson — not retroactive authorizations",
] as const;

export function createProposalDraft(input: {
  title: string;
  communitySlug: string;
  policyPatch: Record<string, unknown>;
  budgetUsd?: number;
  quorumBps?: number;
}): GovernanceProposal {
  return {
    id: `draft-${Date.now()}`,
    title: input.title,
    communitySlug: input.communitySlug,
    status: "draft",
    policyPatch: input.policyPatch,
    budgetUsd: input.budgetUsd,
    quorumBps: input.quorumBps ?? 5000,
    createdAt: new Date().toISOString(),
    voteWeight: "qf_sqrt",
  };
}

export function isProposalExecutable(proposal: GovernanceProposal): boolean {
  return proposal.status === "passed" && Boolean(proposal.policyPatch);
}
