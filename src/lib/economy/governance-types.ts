export type DaoProposalStatus =
  | "draft"
  | "active"
  | "passed"
  | "rejected"
  | "executed"
  | "cancelled";

export type GovernanceVoteWeight = "qf_sqrt" | "one_person" | "capital_stake";

export type GovernanceProposal = {
  id: string;
  title: string;
  communitySlug: string;
  status: DaoProposalStatus;
  policyPatch: Record<string, unknown>;
  budgetUsd?: number;
  quorumBps: number;
  createdAt: string;
  closesAt?: string;
  voteWeight: GovernanceVoteWeight;
  yesVotes?: number;
  noVotes?: number;
};
