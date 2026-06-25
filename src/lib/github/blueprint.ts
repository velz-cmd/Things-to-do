/**
 * RESOLVE GitHub OS — Capital Allocation Operating System blueprint.
 * Machine-readable spec served at GET /api/github/blueprint
 */

export const GITHUB_OS_BLUEPRINT = {
  name: "RESOLVE Capital Allocation Operating System",
  phase: "github-v1",
  category: "Capital Allocation Infrastructure",
  thesis:
    "Money is easy. Knowing where money should go is hard. RESOLVE becomes the source of truth for value attribution — starting with GitHub.",
  inspiration: [
    "Stripe — one problem solved extremely well, then expand",
    "Cloudflare — hundreds of weak signals → one confidence score",
    "Bloomberg — become the source of truth others plug into",
    "Cursor — orchestrator pipeline; components never overwrite each other",
  ],
  antiPatterns: [
    "Multiple AI agents voting and averaging scores",
    "Binary bot detectors (commits/day, AI-assisted code)",
    "Workers talking directly to each other",
    "Scoring before evidence is collected",
    "Blockscout or OpenAlex used for pre-settlement scoring",
  ],
  pipeline: [
    { layer: 1, name: "GitHub Adapter", role: "Collect facts only", ai: false },
    { layer: 2, name: "Normalizer", role: "Common language: artifacts, interactions, outcomes", ai: false },
    { layer: 3, name: "Evidence Bus", role: "Immutable evidence locker — workers publish, never edit", ai: false },
    { layer: 4, name: "Workers (×7)", role: "Enrich evidence — never decide payouts", ai: "partial" },
    { layer: 5, name: "Reasoning Engine", role: "Single synthesis point — reads bus once", ai: true },
    { layer: 6, name: "Confidence Engine", role: "Trust tiers + settlement eligibility", ai: false },
    { layer: 7, name: "Founder Intent", role: "Priority weights steer allocation", ai: false },
    { layer: 8, name: "Allocation Engine", role: "Proportional USDC split", ai: false },
    { layer: 9, name: "Arc Settlement", role: "Escrow → batch distribute", ai: false },
    { layer: 10, name: "Proof Graph", role: "Evidence + reasoning + settlement hashes", ai: false },
  ],
  workers: [
    {
      id: "identity",
      name: "Identity Worker",
      input: "GitHub user profile",
      output: "Identity evidence (confidence only)",
      rejects: false,
      signals: ["account age", "merged PR history", "repo diversity", "followers", "NOT commits/day"],
    },
    {
      id: "repository",
      name: "Repository Worker",
      input: "Repo metadata",
      output: "Repository health evidence",
      signals: ["stars", "forks", "maintainers", "funding gap", "issue backlog"],
    },
    {
      id: "pr",
      name: "PR Worker",
      input: "Merge metadata",
      output: "Contribution evidence",
      signals: ["diff size", "labels", "merge status", "review count"],
    },
    {
      id: "code",
      name: "Code Worker",
      input: "PR diff",
      output: "Code evidence",
      model: "OpenRouter (one model, fast tier) — DeepSeek/Qwen for code",
      signals: ["change type", "complexity", "tests", "architecture"],
    },
    {
      id: "collaboration",
      name: "Collaboration Worker",
      input: "Review threads",
      output: "Collaboration evidence",
      signals: ["review comments", "maintainer engagement", "discussion depth"],
    },
    {
      id: "impact",
      name: "Impact Worker",
      input: "File paths + repo graph",
      output: "Impact evidence",
      signals: ["core modules", "security", "performance", "Libraries.io dependents (optional)"],
    },
    {
      id: "reputation",
      name: "Reputation Worker",
      input: "Historical PRs in repo",
      output: "Reputation context",
      note: "New contributors are NOT punished — less history, not negative score",
    },
  ],
  trustTiers: [
    { tier: "verified", meaning: "High confidence — auto-settle eligible" },
    { tier: "likely_verified", meaning: "Good signals — settle with normal thresholds" },
    { tier: "unknown", meaning: "Insufficient evidence — founder review, not rejection" },
    { tier: "likely_sybil", meaning: "Incoherent evidence — hold from auto-settle" },
    { tier: "rejected", meaning: "Multiple coherence failures — excluded from pool" },
  ],
  apis: {
    required: [
      { name: "GitHub REST API", use: "Commits, files, issues, contributors" },
      { name: "GitHub GraphQL API", use: "Merged PRs, reviews, timeline in one query" },
      { name: "OpenRouter", use: "Code Worker + optional reasoning narrative only" },
    ],
    postSettlement: [
      { name: "Blockscout (Arcscan)", use: "Verify tx, treasury balance — NEVER for scoring" },
    ],
    optional: [
      { name: "Libraries.io", use: "Downstream package dependents for Impact Worker" },
      { name: "OpenAlex", use: "Research repos only — citation impact, ignore for normal OSS" },
    ],
    deferred: ["Discord", "Figma", "X", "Mastodon", "Owncast", "Hugging Face inference"],
  },
  evidenceBus: {
    pattern: "Workers publish → Bus stores → Reasoning Engine reads once",
    rule: "No worker reads another worker's output during enrichment",
  },
  settlementGates: {
    autoSettle: "settlement confidence ≥ 0.72 and ≤ 1 coherence flag",
    founderReview: "confidence 0.55–0.72 or tier = unknown",
    hold: "low confidence but not excluded",
    excluded: "tier likely_sybil/rejected or PR not merged",
  },
  moat: {
    year1: "Evidence data from GitHub repos",
    year2: "Attribution graph — who created value where",
    year3: "Portable reputation across ecosystems",
    year5: "Capital allocation dataset — where money should flow",
  },
  v1ShipList: [
    "Radar — unfunded high-impact repos",
    "Contributor analysis — evidence-based weights",
    "Sybil resistance — confidence tiers, not binary bots",
    "Founder intent — customizable priorities",
    "Allocation engine — transparent proportional split",
    "Arc settlement — USDC batch with proof hash",
    "Proof page — audit every decision",
  ],
} as const;

export type GithubOsBlueprint = typeof GITHUB_OS_BLUEPRINT;
