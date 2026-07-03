import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Compass,
  Search,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import type { DiscoverRole } from "@/lib/discover/role-filters";

export type DiscoverJobId =
  | "fund"
  | "earn"
  | "run"
  | "grants"
  | "find"
  | "automate";

export type DiscoverJob = {
  id: DiscoverJobId;
  /** Accessible full label */
  title: string;
  /** Short pill label shown in the hero */
  who: string;
  surfaces: string;
  role: DiscoverRole;
  scrollTo: string;
  icon: LucideIcon;
};

/** Compact intent modes — Earn · Fund · Build · Automate · Explore */
export const DISCOVER_JOBS: DiscoverJob[] = [
  {
    id: "earn",
    title: "Earn from my work",
    who: "Earn from my work",
    surfaces: "Claim earnings and connect proof sources once",
    role: "community",
    scrollTo: "discover-workspace",
    icon: Sparkles,
  },
  {
    id: "fund",
    title: "Fund value",
    who: "Fund value",
    surfaces: "Fund pools and sponsor payouts through Arc",
    role: "funder",
    scrollTo: "opportunities",
    icon: Wallet,
  },
  {
    id: "run",
    title: "Run a program",
    who: "Run a program",
    surfaces: "Create communities, payout rules, and pools",
    role: "founder",
    scrollTo: "discover-workspace",
    icon: Users,
  },
  {
    id: "automate",
    title: "Run agent intelligence",
    who: "Run agent intelligence",
    surfaces: "Agent signals, source scans, and payout recommendations",
    role: "operator",
    scrollTo: "agent-market",
    icon: Bot,
  },
  {
    id: "grants",
    title: "Launch DAO pool",
    who: "Launch DAO pool",
    surfaces: "Grants, citation tolls, and treasury programs",
    role: "dao",
    scrollTo: "discover-workspace",
    icon: Compass,
  },
  {
    id: "find",
    title: "Explore unpaid value gaps",
    who: "Explore gaps",
    surfaces: "Verified work waiting for rules and funding",
    role: "all",
    scrollTo: "discover-workspace",
    icon: Search,
  },
];

export function discoverJobById(id: DiscoverJobId): DiscoverJob | undefined {
  return DISCOVER_JOBS.find((j) => j.id === id);
}
