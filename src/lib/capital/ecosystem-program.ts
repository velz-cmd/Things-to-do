/**
 * RESOLVE Ecosystem Program — who benefits and how.
 * Single source of truth for the "everyone wins" narrative (bootstrap doctrine).
 */

import {
  RESOLVE_VALUE_CHAIN,
  RESOLVE_WHY_PARAGRAPH,
} from "@/lib/discover/resolve-doctrine";

export type EcosystemRoleId =
  | "creator"
  | "funder"
  | "founder"
  | "operator"
  | "audience";

export type RfbProgramId =
  | "citation-toll"
  | "docs-bounty"
  | "security-fund"
  | "quadratic-funding"
  | "user-centric-royalties"
  | "video-royalties";

export type EcosystemRole = {
  id: EcosystemRoleId;
  label: string;
  headline: string;
  tagline: string;
  before: string;
  after: string;
  youGet: string[];
  youDo: string[];
  youNever: string[];
  cta: { label: string; href: string };
  accent: "emerald" | "violet" | "blue" | "orange" | "slate";
};

export type RfbProgram = {
  id: RfbProgramId;
  rfb: string;
  /** User-facing badge — no internal RFB numbers in UI */
  trackLabel: string;
  name: string;
  upstream: string;
  whoBenefits: string;
  funderGets: string;
  founderGets: string;
  audienceNote: string;
  communities: string[];
};

export const ECOSYSTEM_LOOP = RESOLVE_VALUE_CHAIN.map((step, i) => ({
  step: i + 1,
  title: step.stage,
  detail: step.detail,
}));

export const ECOSYSTEM_ROLES: EcosystemRole[] = [
  {
    id: "creator",
    label: "Creator",
    headline: "Your work already creates value",
    tagline: "Contributor, artist, maintainer, researcher",
    before: "Nobody knows I exist.",
    after: "My work automatically becomes funding opportunities.",
    youGet: [
      "You've earned $X — notification when connectors recognize your work",
      "Claim to your wallet when programs are funded",
      "Earnings history per source (GitHub, Jellyfin, music, citations)",
      "Public receipts — proof without needing a RESOLVE account first",
    ],
    youDo: [
      "Keep using GitHub, Navidrome, Jellyfin, Open Collective as normal",
      "Link identity once (GitHub, MusicBrainz) when you're ready to claim",
    ],
    youNever: [
      "Migrate your audience to RESOLVE",
      "Ask a founder to 'decide' if you deserve pay",
      "Pay platform fees to discover you earned something",
    ],
    cta: { label: "See your earnings", href: "/profile" },
    accent: "emerald",
  },
  {
    id: "funder",
    label: "Funder",
    headline: "Fund where proof already exists",
    tagline: "Anyone with capital — no insider knowledge required",
    before: "I guess where money should go.",
    after: "I fund where the ledger already shows a gap.",
    youGet: [
      "Browse programs ranked by pending obligations",
      "Clear the authorization queue or fund a QF match pool (from $5)",
      "Track fulfillment ratio or match leverage toward 2× verified value",
      "Portfolio history + public receipts — proof your capital did its job",
    ],
    youDo: [
      "Discover communities you don't know — sorted by where capital unlocks most",
      "Deposit into program pools; RESOLVE routes to verified payees",
    ],
    youNever: [
      "Get guaranteed stock returns — 2× is verified community value, not ROI",
      "Subsidize from RESOLVE platform treasury — every dollar is funder/operator capital",
      "Pick winners in secret — allocations follow program rules and sensors",
    ],
    cta: { label: "Fulfill a program", href: "/capital?tab=programs" },
    accent: "violet",
  },
  {
    id: "founder",
    label: "Founder",
    headline: "Capital flows where sensors prove impact",
    tagline: "Builder, maintainer lead, collective steward",
    before: "I don't know who deserves funding.",
    after: "RESOLVE continuously tells me where capital should go.",
    youGet: [
      "Install RFB programs beside upstream communities (one click)",
      "Sensors authorize automatically — docs merges, plays, citations, OC contributions",
      "Strangers can fund your programs without knowing you personally",
      "Operator retainers where programs define them (e.g. security fund)",
    ],
    youDo: [
      "Connect sensors (GitHub, Open Collective, Jellyfin)",
      "Deploy programs and optionally fulfill your community's queue",
      "Focus on community — capital discovery is built in",
    ],
    youNever: [
      "Be the single point of failure for who gets paid",
      "Convince users to leave their normal apps",
      "Run analysis wizards as the only path to value",
    ],
    cta: { label: "Install a community", href: "/communities" },
    accent: "blue",
  },
  {
    id: "operator",
    label: "Operator",
    headline: "Connect once — settlement runs itself",
    tagline: "Instance admin, label, collective host",
    before: "I manually track who did what.",
    after: "Sensors connect once — health and settlement run themselves.",
    youGet: [
      "One install covers every contributor on your instance",
      "Health dashboard: events today, authorizations, sensor status",
      "Optional: fulfill pending obligations for your people",
      "Doctrine-aligned copy your community can trust",
    ],
    youDo: [
      "Attach RESOLVE beside Navidrome, Jellyfin, or GitHub org",
      "Let sensors run — contributors get notified when owed",
    ],
    youNever: [
      "Migrate your users to a new platform",
      "Manually approve every payout",
    ],
    cta: { label: "Open Communities", href: "/communities" },
    accent: "orange",
  },
  {
    id: "audience",
    label: "Audience",
    headline: "You don't need RESOLVE",
    tagline: "Listener, viewer, reader, user",
    before: "My plays and views disappear.",
    after: "Verified listening helps creators earn — I change nothing.",
    youGet: [
      "Keep using the apps you already love — zero change",
      "Your plays, views, and usage help creators get recognized upstream",
      "No account, no wallet, no migration",
    ],
    youDo: [
      "Nothing — that's the point",
    ],
    youNever: [
      "Sign up for RESOLVE",
      "Install anything",
      "Pay extra",
    ],
    cta: { label: "Learn how it works", href: "/discover#how-it-works" },
    accent: "slate",
  },
];

export const RFB_PROGRAMS: RfbProgram[] = [
  {
    id: "user-centric-royalties",
    rfb: "RFB #7",
    trackLabel: "Royalties",
    name: "User-centric royalties",
    upstream: "ListenBrainz · Navidrome · MusicBrainz",
    whoBenefits: "Artists, composers, producers — credited per verified play",
    funderGets: "Fulfillment ratio — every $1 funded clears owed play authorizations",
    founderGets: "Music community operator — install once, sensors run",
    audienceNote: "Listeners stay on Navidrome / their music app",
    communities: ["independent-music", "navidrome"],
  },
  {
    id: "video-royalties",
    rfb: "RFB #7",
    trackLabel: "Video",
    name: "Video watch royalties",
    upstream: "Jellyfin sessions API",
    whoBenefits: "Video creators and hosts — per verified watch",
    funderGets: "Fulfillment ratio on watch authorizations",
    founderGets: "Jellyfin instance operator — sidecar attach",
    audienceNote: "Viewers keep using Jellyfin normally",
    communities: ["jellyfin"],
  },
  {
    id: "docs-bounty",
    rfb: "RFB #3",
    trackLabel: "Docs",
    name: "Documentation bounty",
    upstream: "GitHub merged docs PRs",
    whoBenefits: "Maintainers and doc authors — merged PRs authorize pay",
    funderGets: "Clear docs authorizations in the queue",
    founderGets: "OSS program operator — GitHub sensor ingests automatically",
    audienceNote: "Developers keep using GitHub",
    communities: ["react", "linux", "open-writers"],
  },
  {
    id: "security-fund",
    rfb: "RFB #4",
    trackLabel: "Security",
    name: "Security response fund",
    upstream: "GitHub security advisories",
    whoBenefits: "Security maintainers — CVE triage and patch review",
    funderGets: "Fulfill security authorizations + retainer slots",
    founderGets: "Operator retainers where program rules define them",
    audienceNote: "Users keep using software as normal",
    communities: ["linux"],
  },
  {
    id: "citation-toll",
    rfb: "RFB #2",
    trackLabel: "Research",
    name: "Citation toll",
    upstream: "OpenAlex verified citations",
    whoBenefits: "Researchers and authors — micropayment per citation",
    funderGets: "Fulfill citation authorizations in open science",
    founderGets: "Research community operator",
    audienceNote: "Readers don't need RESOLVE",
    communities: ["open-research"],
  },
  {
    id: "quadratic-funding",
    rfb: "RFB #6",
    trackLabel: "Grants",
    name: "Quadratic funding round",
    upstream: "Open Collective contributions",
    whoBenefits: "Hosted projects — small donors amplified by match pool",
    funderGets: "Match leverage toward 2× — community contributions + matched payouts per $1 in pool",
    founderGets: "QF round operator — OC sensor + match allocator",
    audienceNote: "OC donors keep using Open Collective",
    communities: ["react"],
  },
];

export const ECOSYSTEM_FAQ = [
  {
    q: "Who pays creators?",
    a: "Funders and operators who deposit into program pools. RESOLVE does not print money from a platform treasury — it verifies and routes capital that already entered the program.",
  },
  {
    q: "Do I need to know a community to fund it?",
    a: "No. Discover ranks programs by pending obligations and where capital unlocks verified value. You can fund strangers' programs from $5.",
  },
  {
    q: "What does 2× mean for funders?",
    a: "Verified economic value, not stock returns. For bounties: $1 funded cleared $2+ in settled authorizations. For QF: $1 in match pool unlocked $2+ in OC contributions + matched payouts.",
  },
  {
    q: "What do founders earn?",
    a: "They operate programs and may receive operator retainers where rules define them. They don't invent who deserves pay — sensors authorize at event time.",
  },
  {
    q: "Does my audience need RESOLVE?",
    a: "Never. Listeners, viewers, and readers stay on upstream apps. RESOLVE attaches beside those tools.",
  },
] as const;

export const ECOSYSTEM_PROGRAM_INTRO = RESOLVE_WHY_PARAGRAPH;

export function roleById(id: EcosystemRoleId): EcosystemRole | undefined {
  return ECOSYSTEM_ROLES.find((r) => r.id === id);
}
