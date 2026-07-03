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
    title: "Earn from verified work",
    who: "Earn",
    surfaces: "Claim earnings and connect identity",
    role: "community",
    scrollTo: "discover-workspace",
    icon: Sparkles,
  },
  {
    id: "fund",
    title: "Fund where value is blocked",
    who: "Fund",
    surfaces: "Fund pools and sponsor payouts on Arc",
    role: "funder",
    scrollTo: "opportunities",
    icon: Wallet,
  },
  {
    id: "run",
    title: "Run a payout program",
    who: "Build",
    surfaces: "Create communities, payout rules, and pools",
    role: "founder",
    scrollTo: "discover-workspace",
    icon: Users,
  },
  {
    id: "automate",
    title: "Automate when proof arrives",
    who: "Automate",
    surfaces: "Auto-pay rules, agent signals, and payout caps",
    role: "operator",
    scrollTo: "value-bubblemap",
    icon: Bot,
  },
  {
    id: "grants",
    title: "Launch DAO or grant pool",
    who: "Launch",
    surfaces: "Grants, citation tolls, and treasury programs",
    role: "dao",
    scrollTo: "discover-workspace",
    icon: Compass,
  },
  {
    id: "find",
    title: "Explore unpaid value gaps",
    who: "Explore",
    surfaces: "Verified work waiting for rules and funding",
    role: "all",
    scrollTo: "discover-workspace",
    icon: Search,
  },
];

export function discoverJobById(id: DiscoverJobId): DiscoverJob | undefined {
  return DISCOVER_JOBS.find((j) => j.id === id);
}
