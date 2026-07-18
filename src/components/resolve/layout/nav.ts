import {
  Compass,
  House,
  CircleDollarSign,
  Layers,
  Sparkles,
  UserRound,
  Wallet,
} from "lucide-react";

/**
 * FROZEN — five primary areas. Network folded into Discover; Communities = operate.
 */
export const PRODUCT_NAV = [
  {
    href: "/",
    label: "Home",
    question: "How does verified work become an earning?",
    icon: House,
    exact: true as const,
  },
  {
    href: "/discover",
    label: "Discover",
    question: "Where does value already exist?",
    icon: Compass,
    exact: false as const,
  },
  {
    href: "/mission",
    label: "Mission",
    question: "What should I do?",
    icon: Sparkles,
    exact: false as const,
  },
  {
    href: "/communities",
    label: "Communities",
    question: "How is this community operating?",
    icon: Layers,
    exact: false as const,
  },
  {
    href: "/earn",
    label: "Earn",
    question: "What value did I create and what can I receive?",
    icon: CircleDollarSign,
    exact: false as const,
  },
  {
    href: "/capital",
    label: "Capital",
    question: "Where should money move?",
    icon: Wallet,
    exact: false as const,
  },
  {
    href: "/profile",
    label: "Profile",
    question: "Who am I across this ecosystem?",
    icon: UserRound,
    exact: false as const,
  },
] as const;

/** @deprecated */
export const MISSION_NAV = PRODUCT_NAV;

/** Tools inside Mission sidebar — NOT top-level tabs */
export const MISSION_TOOLS = [
  { id: "command", label: "Command", question: "Reason about this mission" },
  { id: "context", label: "Context", question: "Mission scope & entities" },
  { id: "network", label: "Network", question: "Graph for this mission" },
  { id: "entities", label: "Entities", question: "People, projects, works" },
  { id: "capital", label: "Capital", question: "Money in scope" },
  { id: "policies", label: "Policies", question: "Allocation rules" },
  { id: "history", label: "History", question: "Observations & payments" },
] as const;

/** Capital page sections — four blocks, not tabs */
export const CAPITAL_SECTIONS = [
  { id: "treasury", label: "Treasury" },
  { id: "pending", label: "Pending" },
  { id: "claims", label: "Claims" },
  { id: "history", label: "History" },
] as const;

/** Legacy routes → frozen IA */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/": "/",
  "/home": "/",
  "/workspace": "/mission",
  "/control": "/mission",
  "/start": "/mission",
  "/activity": "/discover",
  "/network": "/discover",
  "/payments": "/capital",
  "/treasury": "/capital",
  "/settle": "/capital",
  "/distribute": "/capital",
  "/missions": "/mission",
  "/connectors": "/settings",
  "/radar": "/discover",
  "/weight": "/mission",
  "/methodology": "/mission",
  "/signals": "/mission",
  "/blueprint": "/mission",
  "/protocol": "/mission",
};
