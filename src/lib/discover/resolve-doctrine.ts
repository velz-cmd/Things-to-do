/**
 * RESOLVE doctrine — why we exist, not just what we do.
 * Backend stays technical; frontend answers "why would I click this?"
 */

/** The existential thesis — everything follows from this. */
export const RESOLVE_EXISTENTIAL_THESIS =
  "The internet already knows who creates value. It just doesn't know how to pay them.";

/** Product doctrine — not funding, grants, or creator economy. */
export const RESOLVE_DOCTRINE =
  "Every verified contribution deserves programmable capital.";

/** Settlement split — bigger than "coordinates". */
export const RESOLVE_SETTLEMENT_LINE =
  "Circle moves the money. RESOLVE decides where it should move.";

/** The $2B answer in one paragraph. */
export const RESOLVE_WHY_PARAGRAPH =
  "Communities already produce value — merges, plays, citations, watches — but money and proof live in different places. " +
  "GitHub, ListenBrainz, OpenAlex, Jellyfin, and Mastodon already know who creates value. Payments don't. " +
  "RESOLVE sits beside the tools you already run — attach to React, Navidrome, Jellyfin, not migrate away — " +
  "turns verified signals into proof, programs, capital, and economic memory. " +
  "Open source because trust requires inspectable rails. " +
  RESOLVE_SETTLEMENT_LINE;

/** Full value chain — every step compounds. */
export const RESOLVE_VALUE_CHAIN = [
  { stage: "Signals", detail: "Plays, merges, citations, watches — already recorded upstream" },
  { stage: "Proof", detail: "Connectors authorize what is owed at event time" },
  { stage: "Value", detail: "Ledger shows who created what, where gaps exist" },
  { stage: "Programs", detail: "RFB rails install beside communities you already run" },
  { stage: "Capital", detail: "Funders fulfill where proof exists — no insider knowledge" },
  { stage: "Automation", detail: "Rules execute when sensors fire — no monthly debate" },
  { stage: "Settlement", detail: "USDC on Arc with public receipts" },
  { stage: "Memory", detail: "Retention, docs, velocity, incidents — smarter next funding round" },
] as const;

/** Emotional hooks — why people care, not what software records. */
export const RESOLVE_EMOTIONAL_HOOKS = [
  {
    who: "Developer",
    hook: "I merged documentation. Why shouldn't I automatically get paid?",
  },
  {
    who: "Artist",
    hook: "People listened to my music. Why shouldn't I automatically earn?",
  },
  {
    who: "Researcher",
    hook: "Thousands cite my paper. Why is nobody funding me?",
  },
  {
    who: "Maintainer",
    hook: "Millions use my package. Why am I still unpaid?",
  },
] as const;

/** Role transformation — before → after, not generic feature lists. */
export type ResolveRoleTransformation = {
  role: string;
  before: string;
  after: string;
};

export const RESOLVE_ROLE_TRANSFORMATIONS: ResolveRoleTransformation[] = [
  {
    role: "Founder",
    before: "I don't know who deserves funding.",
    after: "RESOLVE continuously tells me where capital should go.",
  },
  {
    role: "Builder",
    before: "Nobody knows I exist.",
    after: "My work automatically becomes funding opportunities.",
  },
  {
    role: "Artist",
    before: "Streams disappear into Spotify.",
    after: "Verified listening creates programmable payments.",
  },
  {
    role: "Funder",
    before: "I guess where money should go.",
    after: "I fund where the ledger already shows a gap.",
  },
  {
    role: "DAO",
    before: "Monthly governance debates.",
    after: "Policy executes automatically when proof arrives.",
  },
  {
    role: "Operator",
    before: "I manually track who did what.",
    after: "Sensors connect once — health and settlement run themselves.",
  },
];

/** Communities RESOLVE attaches to — not "create new community". */
export const RESOLVE_ATTACH_TARGETS = [
  "React",
  "Navidrome",
  "Mastodon",
  "Jellyfin",
  "Godot",
  "Linux",
  "Blender",
] as const;
