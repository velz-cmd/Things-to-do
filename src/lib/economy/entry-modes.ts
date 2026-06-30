import type { EntryDoor } from "./types";

/** Seven entry doors — Codex product shape + Settle rail */
export const ENTRY_DOORS: EntryDoor[] = [
  {
    id: "earn",
    label: "Earn",
    headline: "Find money you are owed",
    description:
      "Creators discover earnings from work already recorded upstream — no migration, no begging founders.",
    dashboardPath: "/profile?tab=earnings",
    engineIds: ["earn"],
    primaryCta: { label: "See your earnings", href: "/profile" },
    habitLoop: "Work as usual → notification → claim → share receipt",
  },
  {
    id: "fund",
    label: "Fund",
    headline: "Put capital into verified value",
    description:
      "Choose impact, sponsor, repayment, risk, or growth return. Clear obligations ranked by community need.",
    dashboardPath: "/capital?tab=programs",
    engineIds: ["fund", "repayment"],
    primaryCta: { label: "Fulfill a program", href: "/capital" },
    habitLoop: "See pending queue → stake → impact page updates → fund again",
  },
  {
    id: "operate",
    label: "Operate",
    headline: "Run a program or community economy",
    description:
      "Install sensors, deploy programs, let strangers fund — replace spreadsheets and payout chaos.",
    dashboardPath: "/communities",
    engineIds: ["operate"],
    primaryCta: { label: "Install a community", href: "/communities" },
    habitLoop: "Install → sensors authorize → deploy → strangers fund → settle",
  },
  {
    id: "protect",
    label: "Protect",
    headline: "Fund dependencies and reduce risk",
    description:
      "Companies map critical packages and unpaid maintainers — fund before production breaks.",
    dashboardPath: "/mission?intent=risk",
    engineIds: ["risk"],
    primaryCta: { label: "Dependency risk map", href: "/mission" },
    habitLoop: "Risk report → fund security/docs → compliance receipt → renew",
  },
  {
    id: "grow",
    label: "Grow",
    headline: "Fund builders who grow your ecosystem",
    description:
      "Seed maintainer funds and QF rounds that expand the contributor graph you depend on.",
    dashboardPath: "/capital?tab=discover",
    engineIds: ["fund", "operate"],
    primaryCta: { label: "Discover programs", href: "/discover" },
    habitLoop: "Ecosystem gap → fund growth program → more contributors → healthier stack",
  },
  {
    id: "build",
    label: "Build",
    headline: "Use RESOLVE APIs and payment flows",
    description:
      "Create obligations, pools, settlements, and x402 flows — embed programmable money in your product.",
    dashboardPath: "/stack#economic-infrastructure",
    engineIds: ["build"],
    primaryCta: { label: "Infrastructure manifest", href: "/api/economy/infrastructure" },
    habitLoop: "API key → integrate → volume → metered fees → expand",
  },
  {
    id: "settle",
    label: "Settle",
    headline: "Move money with proof on Arc",
    description:
      "Batch memo payouts, treasury readiness, claim release — Circle dev wallets on Arc testnet.",
    dashboardPath: "/capital?tab=treasury",
    engineIds: ["earn", "fund", "operate"],
    primaryCta: { label: "Treasury status", href: "/api/treasury/arc-readiness" },
    habitLoop: "Authorize → fund → deploy → Arc tx → public receipt",
  },
];

export function getEntryDoor(id: EntryDoor["id"]): EntryDoor | undefined {
  return ENTRY_DOORS.find((d) => d.id === id);
}

export function resolveEntryDoorFromPath(pathname: string): EntryDoor | undefined {
  if (pathname.startsWith("/profile") || pathname.startsWith("/claim")) {
    return getEntryDoor("earn");
  }
  if (pathname.startsWith("/capital")) return getEntryDoor("fund");
  if (pathname.startsWith("/communities")) return getEntryDoor("operate");
  if (pathname.startsWith("/mission")) return getEntryDoor("protect");
  if (pathname.startsWith("/discover")) return getEntryDoor("grow");
  if (pathname.startsWith("/stack") || pathname.startsWith("/api/economy")) {
    return getEntryDoor("build");
  }
  return undefined;
}
