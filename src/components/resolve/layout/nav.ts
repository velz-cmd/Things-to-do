import { Sparkles, Wallet, User } from "lucide-react";

/**
 * Minimal product nav — three tabs, diamond value each.
 * Observe · Decide · Verify live inside Mission (chat + feed), not separate pages.
 */
export const PRODUCT_NAV = [
  {
    href: "/control",
    label: "Mission",
    tagline: "State intent — RESOLVE reasons, you approve, USDC settles",
    icon: Sparkles,
    exact: false as const,
  },
  {
    href: "/payments",
    label: "Capital",
    tagline: "Treasury, claims, settlement — when money is ready to move",
    icon: Wallet,
    exact: false as const,
  },
  {
    href: "/profile",
    label: "Me",
    tagline: "Identity, wallets, sensors",
    icon: User,
    exact: false as const,
  },
] as const;

/** @deprecated */
export const MISSION_NAV = PRODUCT_NAV;

/** Secondary routes — no top-nav tab; reached from Mission chat/actions */
export const SECONDARY_ROUTES = {
  fund: "/decide",
  policies: "/control?panel=policies",
} as const;

/** Legacy routes → three-tab product */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/workspace": "/control",
  "/activity": "/control",
  "/network": "/control",
  "/discover": "/control",
  "/radar": "/control",
  "/weight": "/control",
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
  "/connectors": "/profile",
  "/workspace/fund": "/decide",
};
