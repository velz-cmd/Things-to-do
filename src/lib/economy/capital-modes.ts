import type { CapitalMode } from "./types";

export const CAPITAL_MODES: CapitalMode[] = [
  {
    id: "impact",
    label: "Impact return",
    funderGets:
      "Public proof, reputation, fulfillment ratio, verified community value toward 2× target",
    bestFor: ["funder", "dao_member"],
    programTemplates: [
      "user-centric-royalties",
      "docs-bounty",
      "citation-toll",
      "quadratic-funding",
      "video-royalties",
    ],
    shipped: true,
  },
  {
    id: "sponsor",
    label: "Sponsor return",
    funderGets:
      "Sponsor status, priority access, branded impact page, ecosystem reports",
    bestFor: ["company", "funder"],
    programTemplates: ["quadratic-funding", "security-fund", "dao-contributor-payroll"],
    shipped: false,
  },
  {
    id: "repayment",
    label: "Repayment return",
    funderGets:
      "Capped payback (1.2×–1.5×) from future inflows — sponsorship, OC, API revenue, donations",
    bestFor: ["funder", "company"],
    programTemplates: ["revenue-share-pool", "oss-maintainer-fund"],
    repaymentCapMultiplier: { min: 1.2, max: 1.5 },
    shipped: false,
  },
  {
    id: "risk",
    label: "Risk return",
    funderGets:
      "Dependency risk reduction, compliance trail, security/docs funding proof for procurement",
    bestFor: ["company"],
    programTemplates: ["dependency-insurance", "security-fund"],
    shipped: false,
  },
  {
    id: "growth",
    label: "Growth return",
    funderGets:
      "Fund builders who grow your ecosystem — healthier dependency graph, more contributors",
    bestFor: ["founder", "company", "dao_member"],
    programTemplates: ["oss-maintainer-fund", "docs-bounty", "quadratic-funding"],
    shipped: false,
  },
];

export const DEFAULT_REPAYMENT_BPS = 1500;
export const DEFAULT_REPAYMENT_CAP_MULTIPLIER = 1.5;

export function getCapitalMode(id: CapitalMode["id"]): CapitalMode | undefined {
  return CAPITAL_MODES.find((m) => m.id === id);
}
