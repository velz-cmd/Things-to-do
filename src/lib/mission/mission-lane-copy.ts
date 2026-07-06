import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CircleDollarSign,
  Layers,
  LineChart,
  Link2,
  MessageCircle,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { CommunityKind } from "@/lib/mission/community/types";
import { RFB_PROGRAMS } from "@/lib/capital/ecosystem-program";
import { PLATFORM_LOOP_TAGLINE } from "@/lib/economy/platform-loop";
import { RESOLVE_SETTLEMENT_LINE } from "@/lib/discover/resolve-doctrine";

export const MISSION_HERO_TITLE = "Your work has value — even in cents.";

export const MISSION_HERO_SUBTITLE =
  "Creators and contributors: check what's owed, link your identity, ask questions — free. Funders and operators: simulate payouts when you're ready to move money.";

export const MISSION_HERO_EYEBROW = "For creators · contributors · funders";

export const MISSION_COMPETITIVE_EDGE =
  "Micropay agents stop at the toll booth. RESOLVE runs the full loop — observe, reason, fund, settle, remember.";

/** Plain-language value for “Hire intel” — optional path for operators, not required for creators. */
export const MISSION_HIRE_INTEL = {
  title: "Optional · hire intel (funders & operators)",
  lead: "Planning a payout? Pay cents for verified context, then turn it into a payee plan. Creators can skip this — use the free paths above.",
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

/** Creator-first paths — no pool, batch, or treasury required. */
export const MISSION_CREATOR_VALUE = {
  title: "For creators & contributors",
  lead: "You don't need to fund a pool. Mission shows what's already owed from your link, plays, merges, or citations — often cents until someone funds the gap.",
  bullets: [
    "See claimable earnings tied to your real work — not a demo scorecard",
    "Link GitHub, music, or profile so value follows your creator identity",
    "Ask why you appear in a program or who benefits from what you made",
  ],
  actions: [
    {
      id: "owed",
      label: "What am I owed?",
      detail: "Free · claimable balance",
      prompt:
        "What have I earned from my contributions? Show claimable balance, authorized cents, and what's still waiting for pool funding.",
    },
    {
      id: "link",
      label: "Link my work",
      detail: "Connect identity · free",
      prompt:
        "Help me link my GitHub and creator profiles so RESOLVE can recognize my contributions, plays, and citations.",
    },
    {
      id: "why",
      label: "Why is my work valued?",
      detail: "Free · evidence-backed",
      prompt:
        "Explain how my open-source or creative work is recognized here — who consumed it and what might be owed to me.",
    },
  ],
  profileHref: "/profile?tab=earnings",
} as const;

export type MissionJobId =
  | "agent"
  | "fund"
  | "simulate"
  | "install"
  | "research"
  | "settle"
  | "claim"
  | "link"
  | "discover";

export type MissionPrimaryIntent = {
  id: MissionJobId;
  label: string;
  detail: string;
  prompt: string;
  icon: LucideIcon;
  tone: "sky" | "violet" | "emerald" | "amber";
};

/** Hero tiles — creators first; funders use More / templates. */
export const MISSION_PRIMARY_INTENTS: MissionPrimaryIntent[] = [
  {
    id: "claim",
    label: "What am I owed?",
    detail: "Free · earnings in cents",
    prompt: MISSION_CREATOR_VALUE.actions[0]!.prompt,
    icon: Wallet,
    tone: "emerald",
  },
  {
    id: "link",
    label: "Link my work",
    detail: "Creator identity · no payment",
    prompt: MISSION_CREATOR_VALUE.actions[1]!.prompt,
    icon: Link2,
    tone: "sky",
  },
  {
    id: "discover",
    label: "Ask anything",
    detail: "Free · gaps & recognition",
    prompt: MISSION_CREATOR_VALUE.actions[2]!.prompt,
    icon: MessageCircle,
    tone: "violet",
  },
];

export const MISSION_FUNDER_INTENTS: MissionPrimaryIntent[] = [
  {
    id: "fund",
    label: "Settle batch",
    detail: "Blueprint · simulate · authorize",
    prompt: "Prepare royalty settlement for independent music artists — show play-weighted payees.",
    icon: LineChart,
    tone: "sky",
  },
  {
    id: "agent",
    label: "Hire intel",
    detail: "From $0.001/signal → payee plan",
    prompt: "Run intel on React maintainers — docs gaps and contributor health",
    icon: Bot,
    tone: "violet",
  },
  {
    id: "simulate",
    label: "Batch payout",
    detail: "PDF memo → % split",
    prompt: "Batch payout from PDF — allocate $5,000 split between maintainers with percentages",
    icon: CircleDollarSign,
    tone: "amber",
  },
];

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
