import type { MissionJobId } from "@/lib/mission/mission-lane-copy";

export type MissionRfbTemplate = {
  id: string;
  label: string;
  templateId: string;
  job: MissionJobId;
  prompt: string;
  surfaces: string;
};

/** One-click RFB mission templates (Phase 7.3). */
export const MISSION_RFB_TEMPLATES: MissionRfbTemplate[] = [
  {
    id: "qf-round",
    label: "QF round",
    templateId: "quadratic-funding",
    job: "fund",
    surfaces: "Quadratic funding · communal pool",
    prompt: "Fund a quadratic funding round for React maintainers — $2,500 simulate allocation.",
  },
  {
    id: "citation-payout",
    label: "Citation payout",
    templateId: "citation-toll",
    job: "research",
    surfaces: "OpenAlex · author toll",
    prompt: "Run a citation payout round for research authors — split by OpenAlex impact signals.",
  },
  {
    id: "royalty-batch",
    label: "Royalty batch",
    templateId: "royalty-split",
    job: "settle",
    surfaces: "Plays · attribution ledger",
    prompt: "Prepare royalty settlement for independent music artists — show play-weighted payees.",
  },
  {
    id: "docs-bounty",
    label: "Docs bounty",
    templateId: "documentation-bounty",
    job: "install",
    surfaces: "RFB install · maintainer docs",
    prompt: "Install a documentation bounty program for the React ecosystem.",
  },
];
