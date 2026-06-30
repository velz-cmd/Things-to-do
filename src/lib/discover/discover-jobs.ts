import type { LucideIcon } from "lucide-react";
import {
  Coins,
  Compass,
  Radio,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import type { DiscoverRole } from "@/lib/discover/role-filters";

export type DiscoverJobId =
  | "earn"
  | "fund"
  | "run"
  | "observe"
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

/** Primary Discover entry — maps to existing roles and section anchors. */
export const DISCOVER_JOBS: DiscoverJob[] = [
  {
    id: "earn",
    title: "Earn from my work",
    who: "Community · creator",
    surfaces: "Claim, artist & OSS receipts, identity connect",
    role: "community",
    scrollTo: "trending",
    icon: Coins,
  },
  {
    id: "fund",
    title: "Fund where it matters",
    who: "Funder",
    surfaces: "Opportunity board, fulfillment queue, wallet",
    role: "funder",
    scrollTo: "opportunities",
    icon: Wallet,
  },
  {
    id: "run",
    title: "Run my community",
    who: "Founder",
    surfaces: "Community console, programs, sensors",
    role: "founder",
    scrollTo: "communities",
    icon: Users,
  },
  {
    id: "observe",
    title: "Connect & observe",
    who: "Operator",
    surfaces: "Sensor connect, health, live feed",
    role: "operator",
    scrollTo: "live-feed",
    icon: Radio,
  },
  {
    id: "grants",
    title: "Launch grants / pools",
    who: "DAO",
    surfaces: "Quadratic funding, treasury, payroll",
    role: "dao",
    scrollTo: "radar-dao",
    icon: Compass,
  },
  {
    id: "find",
    title: "Find opportunities",
    who: "Everyone",
    surfaces: "Search and scored opportunity board",
    role: "all",
    scrollTo: "discover-search",
    icon: Search,
  },
];

export function discoverJobById(id: DiscoverJobId): DiscoverJob | undefined {
  return DISCOVER_JOBS.find((j) => j.id === id);
}
