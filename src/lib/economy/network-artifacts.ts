import type { NetworkArtifact } from "./types";

/** Network artifacts — every settlement brings someone back (Codex Phase 5) */
export const NETWORK_ARTIFACTS: NetworkArtifact[] = [
  {
    kind: "claim_receipt",
    actor: "creator",
    label: "Claim receipt",
    pathPattern: "/receipt/{id}",
    retentionHook: "Share proof — next creator discovers RESOLVE",
    shipped: true,
  },
  {
    kind: "funder_impact",
    actor: "funder",
    label: "Funder impact page",
    pathPattern: "/capital?program={id}&view=impact",
    retentionHook: "Fulfillment ratio updates — fund again when queue grows",
    shipped: false,
  },
  {
    kind: "operator_program",
    actor: "founder",
    label: "Program operations page",
    pathPattern: "/communities/{slug}/programs/{id}",
    retentionHook: "Sensor health + stranger funding notifications",
    shipped: true,
  },
  {
    kind: "company_risk_report",
    actor: "company",
    label: "Dependency risk report",
    pathPattern: "/mission?export=risk",
    retentionHook: "Quarterly renew — fund before breakage",
    shipped: false,
  },
  {
    kind: "developer_api_key",
    actor: "developer",
    label: "API console",
    pathPattern: "/stack#build-engine",
    retentionHook: "Usage dashboard — expand integration",
    shipped: false,
  },
  {
    kind: "dao_settlement_archive",
    actor: "dao_member",
    label: "Settlement archive",
    pathPattern: "/ledger?community={slug}",
    retentionHook: "Governance audit trail — propose next round",
    shipped: false,
  },
  {
    kind: "repayment_statement",
    actor: "funder",
    label: "Repayment statement",
    pathPattern: "/capital?program={id}&view=repayment",
    retentionHook: "Cap progress toward 1.5× — reinvest surplus",
    shipped: false,
  },
];
