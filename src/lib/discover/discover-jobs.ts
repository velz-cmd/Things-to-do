import type { LucideIcon } from "lucide-react";
import {
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
  | "find";

export type DiscoverJob = {
  id: DiscoverJobId;
  title: string;
  who: string;
  surfaces: string;
  role: DiscoverRole;
  scrollTo: string;
  icon: LucideIcon;
};

/** Compact intent modes — Fund · Earn · Run · Launch · Explore */
export const DISCOVER_JOBS: DiscoverJob[] = [
  {
    id: "earn",
    title: "Earn from work",
    who: "Earn",
    surfaces: "Claim verified earnings and connect identity",
    role: "community",
    scrollTo: "discover-workspace",
    icon: Sparkles,
  },
  {
    id: "fund",
    title: "Fund value",
    who: "Fund",
    surfaces: "Fund pools and sponsor payouts on Arc",
    role: "funder",
    scrollTo: "opportunities",
    icon: Wallet,
  },
  {
    id: "run",
    title: "Run a program",
    who: "Run",
    surfaces: "Create communities, payout rules, and pools",
    role: "founder",
    scrollTo: "discover-workspace",
    icon: Users,
  },
  {
    id: "grants",
    title: "Launch DAO pool",
    who: "Build",
    surfaces: "Grants, citation tolls, and treasury programs",
    role: "dao",
    scrollTo: "discover-workspace",
    icon: Compass,
  },
  {
    id: "find",
    title: "Explore gaps",
    who: "Explore",
    surfaces: "Unpaid value waiting for rules and funding",
    role: "all",
    scrollTo: "discover-workspace",
    icon: Search,
  },
];

export function discoverJobById(id: DiscoverJobId): DiscoverJob | undefined {
  return DISCOVER_JOBS.find((j) => j.id === id);
}
