import type { EconomyProgramTemplate } from "./types";

/** Extended program templates — catalog RFB + Codex high-end templates */
export const ECONOMY_PROGRAM_TEMPLATES: EconomyProgramTemplate[] = [
  {
    id: "user-centric-royalties",
    name: "User-centric royalties",
    rfb: "RFB #7",
    engines: ["earn", "fund", "operate"],
    capitalModes: ["impact", "sponsor"],
    upstream: "ListenBrainz · Navidrome · MusicBrainz",
    description: "Pay artists per verified play — MusicBrainz credit splits.",
    defaultBudgetUsd: 500,
    shipped: true,
    catalogTemplateId: "user-centric-royalties",
  },
  {
    id: "docs-bounty",
    name: "Documentation bounty",
    rfb: "RFB #3",
    engines: ["earn", "fund", "operate"],
    capitalModes: ["impact", "growth", "repayment"],
    upstream: "GitHub",
    description: "Reward merged documentation PRs and tutorial authors.",
    defaultBudgetUsd: 2000,
    shipped: true,
    catalogTemplateId: "docs-bounty",
  },
  {
    id: "security-fund",
    name: "Security response fund",
    rfb: "RFB #4",
    engines: ["earn", "fund", "operate", "risk"],
    capitalModes: ["impact", "risk", "sponsor"],
    upstream: "GitHub",
    description: "CVE triage, patch review, maintainer retainers.",
    defaultBudgetUsd: 5000,
    shipped: true,
    catalogTemplateId: "security-fund",
  },
  {
    id: "quadratic-funding",
    name: "Quadratic funding round",
    rfb: "RFB #6",
    engines: ["earn", "fund", "operate"],
    capitalModes: ["impact", "growth", "sponsor"],
    upstream: "Open Collective",
    description: "QF match pool — √(donor) amplifies many small contributions.",
    defaultBudgetUsd: 10000,
    shipped: true,
    catalogTemplateId: "quadratic-funding",
  },
  {
    id: "citation-toll",
    name: "Citation toll",
    rfb: "RFB #2",
    engines: ["earn", "fund", "operate"],
    capitalModes: ["impact", "sponsor"],
    upstream: "OpenAlex",
    description: "Micropayment per verified citation.",
    defaultBudgetUsd: 1000,
    shipped: true,
    catalogTemplateId: "citation-toll",
  },
  {
    id: "video-royalties",
    name: "Video watch royalties",
    rfb: "RFB #7",
    engines: ["earn", "fund", "operate"],
    capitalModes: ["impact"],
    upstream: "Jellyfin",
    description: "Pay creators per verified watch on self-hosted video.",
    defaultBudgetUsd: 750,
    shipped: true,
    catalogTemplateId: "video-royalties",
  },
  {
    id: "revenue-share-pool",
    name: "Revenue-share pool",
    engines: ["fund", "repayment", "operate"],
    capitalModes: ["repayment"],
    upstream: "Open Collective · GitHub Sponsors · API revenue",
    description:
      "Seed capital now; creators paid immediately; funders receive capped repayment from future inflows.",
    defaultBudgetUsd: 5000,
    shipped: false,
  },
  {
    id: "oss-maintainer-fund",
    name: "OSS maintainer fund",
    engines: ["earn", "fund", "operate", "repayment"],
    capitalModes: ["impact", "repayment", "growth"],
    upstream: "GitHub · Libraries.io",
    description: "Sustain critical maintainers — optional repayment from sponsorship inflows.",
    defaultBudgetUsd: 10000,
    shipped: false,
  },
  {
    id: "dependency-insurance",
    name: "Dependency insurance",
    engines: ["fund", "risk", "operate"],
    capitalModes: ["risk", "sponsor"],
    upstream: "Libraries.io · npm · GitHub",
    description:
      "B2B fund for packages your product depends on — compliance trail and risk dashboard.",
    defaultBudgetUsd: 25000,
    shipped: false,
  },
  {
    id: "dao-contributor-payroll",
    name: "DAO contributor payroll",
    engines: ["earn", "operate", "fund"],
    capitalModes: ["impact", "sponsor"],
    upstream: "GitHub · governance policy",
    description: "Recurring contributor rewards with DAO-approved budget and public settlement archive.",
    defaultBudgetUsd: 15000,
    shipped: false,
  },
  {
    id: "founder-grant-pool",
    name: "Founder grant pool",
    engines: ["fund", "operate"],
    capitalModes: ["impact", "growth", "sponsor"],
    upstream: "RESOLVE program bootstrap",
    description:
      "Strangers fund a founder's sensor bootstrap — operator retainer + 90-day program runway.",
    defaultBudgetUsd: 3000,
    shipped: false,
  },
];

export function getEconomyTemplate(id: string): EconomyProgramTemplate | undefined {
  return ECONOMY_PROGRAM_TEMPLATES.find((t) => t.id === id);
}

export function listTemplatesForCapitalMode(
  modeId: string,
): EconomyProgramTemplate[] {
  return ECONOMY_PROGRAM_TEMPLATES.filter((t) =>
    t.capitalModes.includes(modeId as EconomyProgramTemplate["capitalModes"][number]),
  );
}
