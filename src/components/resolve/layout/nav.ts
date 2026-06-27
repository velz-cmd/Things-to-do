import {
  Eye,
  Brain,
  Scale,
  Zap,
  CheckCircle2,
  User,
} from "lucide-react";

/** Five verbs — the entire product model. Not pages. Missions. */
export const MISSION_NAV = [
  {
    href: "/discover",
    label: "Observe",
    question: "Where does value already exist?",
    icon: Eye,
    exact: false as const,
  },
  {
    href: "/control",
    label: "Understand",
    question: "What matters right now?",
    icon: Brain,
    exact: false as const,
  },
  {
    href: "/decide",
    label: "Decide",
    question: "What needs funding?",
    icon: Scale,
    exact: false as const,
  },
  {
    href: "/payments",
    label: "Execute",
    question: "What is waiting to move?",
    icon: Zap,
    exact: false as const,
  },
  {
    href: "/network",
    label: "Verify",
    question: "What changed?",
    icon: CheckCircle2,
    exact: false as const,
  },
  {
    href: "/profile",
    label: "Me",
    question: "Who am I in this network?",
    icon: User,
    exact: false as const,
  },
] as const;

/** @deprecated Use MISSION_NAV */
export const PRODUCT_NAV = MISSION_NAV;

/** Legacy routes → mission-based surfaces */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/workspace": "/control",
  "/activity": "/network",
  "/radar": "/discover",
  "/weight": "/control",
  "/discover": "/discover",
  "/methodology": "/control",
  "/signals": "/control",
  "/settle": "/payments",
  "/claim": "/payments",
  "/blueprint": "/control",
  "/stack": "/control",
  "/protocol": "/control",
  "/missions": "/decide",
  "/start": "/control",
  "/treasury": "/payments",
  "/distribute": "/payments",
  "/connectors": "/discover",
  "/workspace/fund": "/decide",
};
