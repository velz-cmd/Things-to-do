import type { LucideIcon } from "lucide-react";
import { Bot, CircleDollarSign, Layers, LineChart, Shield, Sparkles } from "lucide-react";
import type { CommunityKind } from "@/lib/mission/community/types";
import { RFB_PROGRAMS } from "@/lib/capital/ecosystem-program";
import { PLATFORM_LOOP_TAGLINE } from "@/lib/economy/platform-loop";
import { RESOLVE_SETTLEMENT_LINE } from "@/lib/discover/resolve-doctrine";

export const MISSION_HERO_TITLE = "Decide, simulate, and authorize — not just micropay.";

export const MISSION_HERO_SUBTITLE =
  "Turn verified signals into a named payee plan — simulate policy, approve once, settle on Arc.";

export const MISSION_COMPETITIVE_EDGE =
  "Micropay agents stop at the toll booth. RESOLVE runs the full loop — observe, reason, fund, settle, remember.";

/** Plain-language value for “Hire intel” — why it is not generic chat. */
export const MISSION_HIRE_INTEL = {
  title: "Hire intel — verified signals, not chat",
  lead: "Pay cents for machine-checked context, then turn it into a named payee plan you can simulate and settle on Arc.",
  bullets: [
    "Micropay ($0.001–$0.10) for docs gaps, sentiment, CVE, or citation checks — each run gets an Arc receipt.",
    "Findings auto-fill Blueprint: who gets paid, how much, and which evidence backed it.",
    "Approve once to simulate policy and authorize settlement — intel is the cheapest step in a dollars-scale decision.",
  ],
  compare:
    "Generic AI stops at text. RESOLVE intel is ledger-ready evidence that feeds the same fund → settle loop as Discover and Capital.",
  examples: [
    {
      label: "Docs review",
      prompt: "Run intel on React maintainers — docs gaps and contributor health",
      price: 0.02,
    },
    {
      label: "Sentiment",
      prompt: "Classify sentiment for maintainer feedback: love the DX but docs lag behind releases.",
      price: 0.001,
    },
  ],
} as const;

export type MissionJobId = "agent" | "fund" | "simulate" | "install" | "research" | "settle";

export type MissionJob = {
  id: MissionJobId;
  who: string;
  surfaces: string;
  prompt: string;
  icon: LucideIcon;
};

export const MISSION_JOBS: MissionJob[] = [
  {
    id: "agent",
    who: "Hire agent intel",
    surfaces: "x402 signals · pay/skip · Arc proof per run",
    prompt: "Run intel on React maintainers — docs gaps and contributor health",
    icon: Bot,
  },
  {
    id: "fund",
    who: "Fund a gap",
    surfaces: "Communal pool · milestone bar · handoff to Capital",
    prompt: "Fund the top open-source maintainers in React based on real contribution signals.",
    icon: CircleDollarSign,
  },
  {
    id: "simulate",
    who: "Simulate allocation",
    surfaces: "Recipients · weights · policy before you move money",
    prompt: "Simulate allocating $5,000 across React maintainers — show recipients and amounts.",
    icon: LineChart,
  },
  {
    id: "install",
    who: "Install program rail",
    surfaces: "RFB templates beside communities you already run",
    prompt: "Help me install a documentation bounty program for the React ecosystem.",
    icon: Layers,
  },
  {
    id: "research",
    who: "Citation round",
    surfaces: "OpenAlex impact · research toll · author payouts",
    prompt: "Run a citation payout round for research authors — split by OpenAlex impact signals.",
    icon: Sparkles,
  },
  {
    id: "settle",
    who: "Prepare settlement",
    surfaces: "Authorization ledger · batch · public receipt",
    prompt: "Prepare settlement package for approved authorizations — show Arc batch proof.",
    icon: Shield,
  },
];

export const MISSION_AGENT_PIPELINE =
  "Pay signal → Blueprint payees → Simulate → Authorize";

/** Where Arc hackathon demos stop vs RESOLVE Mission continues. */
export const MISSION_VS_COMPETITORS = [
  {
    name: "Obolus",
    stopsAt: "Agent pays creator source · citation receipt",
    missionContinues: "Signal feeds named payee Blueprint → communal settle",
  },
  {
    name: "Inktoll",
    stopsAt: "Agent unlocks one article · publisher feed tick",
    missionContinues: "Micropay buys intel → multi-payee batch plan → Arc fulfill",
  },
  {
    name: "Gaffer",
    stopsAt: "Pay to steer one branch · creator earns moment",
    missionContinues: "Paid context → program-weighted allocation → ledger proof",
  },
] as const;

export const MISSION_AGENT_LANE_COPY = {
  tagline: PLATFORM_LOOP_TAGLINE,
  settlement: RESOLVE_SETTLEMENT_LINE,
  paySkipTitle: "Agent pay decision",
  paySkipDetail:
    "Like research agents that toll sources — RESOLVE charges your Arc wallet per signal, records claim-level attribution, and keeps going into fund + settle.",
};

export function rfbProgramsForKind(kind: CommunityKind) {
  const kindToDomain: Partial<Record<CommunityKind, string[]>> = {
    music: ["independent-music", "navidrome"],
    research: ["open-research", "climate-research"],
    oss: ["react", "linux", "open-writers"],
    media: ["jellyfin"],
  };
  const slugs = kindToDomain[kind];
  if (!slugs?.length) return RFB_PROGRAMS.slice(0, 4);
  return RFB_PROGRAMS.filter((p) => p.communities.some((c) => slugs.includes(c))).slice(0, 4);
}
