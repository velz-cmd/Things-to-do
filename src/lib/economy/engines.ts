import type { ProfitEngine } from "./types";

/** Six profit engines — Codex thesis + RESOLVE doctrine */
export const PROFIT_ENGINES: ProfitEngine[] = [
  {
    id: "earn",
    name: "Earn Engine",
    tagline: "You already created value — here is what you can claim",
    forActors: ["creator"],
    valueProposition:
      "Passive discovery of owed money from upstream work — GitHub merges, plays, citations, moderation, dependency usage.",
    mechanisms: [
      "Connector events → authorization ledger",
      "Notify policy (min $0.50, confidence ≥ 0.65)",
      "Universal /claim with GitHub or wallet identity",
      "Public receipts with proof hash",
    ],
    monetization: ["Platform settlement fee on claim volume"],
    entryDoor: "earn",
    apiSurfaces: [
      "GET /api/earn/summary",
      "GET /api/rewards",
      "POST /api/rewards/claim",
      "GET /api/receipt/[id]",
    ],
    shipped: true,
    shippedDetail: "Phase 4 — live sensors, claim loop, Arc settlement",
  },
  {
    id: "fund",
    name: "Fund Engine",
    tagline: "Put capital into verified value — choose your return mode",
    forActors: ["funder", "dao_member", "company"],
    valueProposition:
      "Funders do not donate blindly. They select impact, sponsor, repayment, risk, or growth return — with public proof.",
    mechanisms: [
      "Program stakes from $5 (CommunityFundStake)",
      "QF match pools with √(donor) amplification",
      "Funder discovery ranked by pending obligations",
      "Fulfillment ratio and 2× verified-value target",
    ],
    monetization: ["Settlement fee", "Repayment pool fee (planned)"],
    entryDoor: "fund",
    apiSurfaces: [
      "GET /api/capital/discover",
      "POST /api/capital/fund",
      "GET /api/treasury",
    ],
    shipped: true,
    shippedDetail: "Open stakes + QF — capital modes UI planned",
  },
  {
    id: "operate",
    name: "Operate Engine",
    tagline: "Run community economies with proof — not spreadsheets",
    forActors: ["founder", "operator", "dao_member"],
    valueProposition:
      "Founders install programs beside upstream tools. Sensors authorize; strangers fund; operators retain where rules define.",
    mechanisms: [
      "Community install → program templates → deploy",
      "Sensor pipeline (music, OSS, research, media, QF)",
      "Founder grant pools and operator retainers (rules)",
      "DAO policy proposals → ledger binding (planned)",
    ],
    monetization: ["Operator SaaS (planned)", "Program setup fee (planned)"],
    entryDoor: "operate",
    apiSurfaces: [
      "POST /api/communities/install",
      "POST /api/communities/deploy",
      "GET /api/connectors/phase3/status",
    ],
    shipped: true,
    shippedDetail: "6 RFB templates — SaaS tier planned",
  },
  {
    id: "repayment",
    name: "Repayment Engine",
    tagline: "Seed capital now — capped repayment from future inflows",
    forActors: ["funder", "founder"],
    valueProposition:
      "Programmable revenue-based funding: creators paid immediately; funders receive capped payback from sponsorship, OC, API revenue.",
    mechanisms: [
      "Waterfall: creators → funder repayment → community surplus",
      "Configurable cap (1.2×–1.5× principal)",
      "Inflow source routing (OC, sponsors, API, donations)",
      "Repayment statements as network artifacts",
    ],
    monetization: ["Repayment pool fee on waterfall volume"],
    entryDoor: "fund",
    apiSurfaces: [
      "POST /api/economy/repayment/simulate",
      "GET /api/economy/infrastructure",
    ],
    shipped: false,
    shippedDetail: "Waterfall engine + simulate API — ledger binding next",
  },
  {
    id: "risk",
    name: "Risk Engine",
    tagline: "Fund dependencies before they break — B2B compliance money",
    forActors: ["company", "funder"],
    valueProposition:
      "Companies depend on OSS they do not fund. RESOLVE maps dependency exposure and routes capital to critical maintainers.",
    mechanisms: [
      "Libraries.io + GitHub dependency graph",
      "Critical maintainer unpaid queue",
      "Company risk dashboard and compliance export",
      "Dependency insurance program template",
    ],
    monetization: ["Premium company/DAO reports", "Risk program setup fee"],
    entryDoor: "protect",
    apiSurfaces: [
      "GET /api/workspace/overview",
      "POST /api/weight/challenge",
      "GET /api/economy/infrastructure",
    ],
    shipped: false,
    shippedDetail: "Mission dependency prompts — productized B2B fund next",
  },
  {
    id: "build",
    name: "Build Engine",
    tagline: "Embed programmable money flows — Stripe for community economies",
    forActors: ["developer"],
    valueProposition:
      "Developers and AI agents create obligations, pools, and settlements via API — RESOLVE earns platform and x402 fees.",
    mechanisms: [
      "Authorization ingest API",
      "x402 premium research (Circle Gateway on Arc)",
      "Agent gateway nano-payments",
      "Receipt and identity resolution APIs",
    ],
    monetization: ["API usage metering", "x402 per-call fees"],
    entryDoor: "build",
    apiSurfaces: [
      "POST /api/authorization/ingest",
      "GET /api/x402/premium-research",
      "GET /api/economy/infrastructure",
      "GET /api/settlement/config",
    ],
    shipped: true,
    shippedDetail: "x402 + ingest live — API keys and metering planned",
  },
];

export function getEngine(id: ProfitEngine["id"]): ProfitEngine | undefined {
  return PROFIT_ENGINES.find((e) => e.id === id);
}

export function listShippedEngines(): ProfitEngine[] {
  return PROFIT_ENGINES.filter((e) => e.shipped);
}
