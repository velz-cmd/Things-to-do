import type { CommunityKind } from "./types";
import { COMMUNITY_KIND_LABELS } from "./types";

type PatternRule = {
  kind: CommunityKind;
  patterns: RegExp[];
  keywords: string[];
};

const RULES: PatternRule[] = [
  {
    kind: "music",
    patterns: [
      /\b(music|musician|artist|album|listen|scrobble|royalt|band|spotify|navidrome|musicbrainz|listenbrainz|independent music|creator payout)\b/i,
    ],
    keywords: ["music", "artist", "listenbrainz", "navidrome", "musicbrainz", "album", "royalty"],
  },
  {
    kind: "research",
    patterns: [
      /\b(research|citation|paper|arxiv|journal|scholar|openalex|crossref|grant|academic|university lab)\b/i,
    ],
    keywords: ["research", "citation", "openalex", "arxiv", "paper", "grant"],
  },
  {
    kind: "education",
    patterns: [
      /\b(education|teaching|course|curriculum|mooc|open education|student|learning community|school)\b/i,
    ],
    keywords: ["education", "course", "teaching", "learning"],
  },
  {
    kind: "science",
    patterns: [
      /\b(open science|dataset|reproducib|lab|experiment|public data|scientific)\b/i,
    ],
    keywords: ["science", "dataset", "reproducibility"],
  },
  {
    kind: "local",
    patterns: [
      /\b(pakistan|local community|regional|city|national oss|maintainers in|universities in)\b/i,
    ],
    keywords: ["pakistan", "local", "regional"],
  },
  {
    kind: "protocol",
    patterns: [
      /\b(ethereum|solana|bitcoin|base|evm|blockchain|protocol|l2|defi|validator)\b/i,
    ],
    keywords: ["ethereum", "solana", "base", "protocol", "blockchain"],
  },
  {
    kind: "dao",
    patterns: [/\b(dao|governance|treasury vote|on-chain governance|multisig community)\b/i],
    keywords: ["dao", "governance"],
  },
  {
    kind: "media",
    patterns: [
      /\b(video|podcast|stream|peertube|youtube creator|fediverse|moderator|creator economy)\b/i,
    ],
    keywords: ["video", "podcast", "peertube", "stream"],
  },
  {
    kind: "maps",
    patterns: [/\b(openstreetmap|osm|mapping|geodata|geo community)\b/i],
    keywords: ["openstreetmap", "maps", "geodata"],
  },
  {
    kind: "wiki",
    patterns: [/\b(wikipedia|wiki|documentation community|knowledge base|docs maintain)\b/i],
    keywords: ["wikipedia", "wiki", "documentation"],
  },
  {
    kind: "oss",
    patterns: [
      /\b(open source|oss|github|maintainer|repository|repo|linux|kernel|gnome|fedora|arch|npm|pypi|next\.?js|react|dependency)\b/i,
    ],
    keywords: [
      "react",
      "linux",
      "github",
      "open source",
      "maintainer",
      "nextjs",
      "langchain",
      "rust",
      "python",
    ],
  },
];

/** Named communities / worlds — not repositories. */
export const KNOWN_COMMUNITIES: Array<{ name: string; kind: CommunityKind; aliases: string[] }> = [
  { name: "React", kind: "oss", aliases: ["react", "next.js", "nextjs"] },
  { name: "Linux", kind: "oss", aliases: ["linux", "kernel", "gnome", "fedora", "arch"] },
  { name: "Ethereum", kind: "protocol", aliases: ["ethereum", "eth", "evm"] },
  { name: "Solana", kind: "protocol", aliases: ["solana", "sol"] },
  { name: "Base", kind: "protocol", aliases: ["base"] },
  { name: "Independent Music", kind: "music", aliases: ["independent music", "musicians", "artists"] },
  { name: "Pakistan OSS", kind: "local", aliases: ["pakistan oss", "pakistan open source", "pakistani"] },
  { name: "AI Infrastructure", kind: "oss", aliases: ["ai infrastructure", "llm", "langchain", "ml ops"] },
  { name: "Open Education", kind: "education", aliases: ["open education", "mooc"] },
  { name: "Climate Research", kind: "research", aliases: ["climate research", "climate science"] },
  { name: "Digital Commons", kind: "general", aliases: ["digital commons", "creative commons"] },
  { name: "Creative Commons", kind: "wiki", aliases: ["creative commons", "cc licenses"] },
  { name: "OpenStreetMap", kind: "maps", aliases: ["openstreetmap", "osm"] },
  { name: "MusicBrainz", kind: "music", aliases: ["musicbrainz"] },
  { name: "Wikipedia", kind: "wiki", aliases: ["wikipedia", "wikimedia"] },
  { name: "LangChain", kind: "oss", aliases: ["langchain", "langgraph"] },
  { name: "Linux Foundation", kind: "oss", aliases: ["linux foundation", "lf"] },
];

export function detectCommunityKind(input: {
  question: string;
  communityName?: string;
  keywords?: string[];
}): CommunityKind {
  const haystack = [input.question, input.communityName ?? "", ...(input.keywords ?? [])]
    .join(" ")
    .toLowerCase();

  for (const world of KNOWN_COMMUNITIES) {
    const hit = world.aliases.some((a) => haystack.includes(a.toLowerCase()));
    if (hit || (input.communityName && input.communityName.toLowerCase() === world.name.toLowerCase())) {
      return world.kind;
    }
  }

  let best: { kind: CommunityKind; score: number } = { kind: "general", score: 0 };
  for (const rule of RULES) {
    let score = 0;
    for (const p of rule.patterns) {
      if (p.test(input.question)) score += 3;
    }
    for (const k of rule.keywords) {
      if (haystack.includes(k.toLowerCase())) score += 1;
    }
    if (score > best.score) best = { kind: rule.kind, score };
  }

  return best.score > 0 ? best.kind : "general";
}

export function extractCommunityTargets(question: string): string[] {
  const lower = question.toLowerCase();
  const found: string[] = [];

  for (const world of KNOWN_COMMUNITIES) {
    if (world.aliases.some((a) => lower.includes(a)) || lower.includes(world.name.toLowerCase())) {
      found.push(world.name);
    }
  }

  const legacy = [
    "react",
    "vue",
    "angular",
    "svelte",
    "ethereum",
    "solana",
    "base",
    "bitcoin",
    "langchain",
    "supabase",
    "rust",
    "python",
    "linux",
    "navidrome",
  ];
  for (const k of legacy) {
    if (lower.includes(k.replace(".", "")) || lower.includes(k)) {
      const match = KNOWN_COMMUNITIES.find((w) => w.aliases.includes(k));
      found.push(match?.name ?? k);
    }
  }

  return [...new Set(found)].slice(0, 3);
}

export function resolveCommunityName(input: {
  question: string;
  communityName?: string;
  keywords?: string[];
}): string | undefined {
  if (input.communityName) return input.communityName;
  const targets = extractCommunityTargets(input.question);
  return targets[0];
}

export function communityKindLabel(kind: CommunityKind): string {
  return COMMUNITY_KIND_LABELS[kind];
}

export function seedCommunitiesForKind(kind: CommunityKind): string[] {
  return KNOWN_COMMUNITIES.filter((w) => w.kind === kind).map((w) => w.name).slice(0, 6);
}
