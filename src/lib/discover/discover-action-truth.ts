import type { DiscoverAction } from "@/lib/discover/types";

export type ActionExecutionTruth = {
  badge: string;
  detail: string;
  arcSettlement: boolean;
};

const TRUTH: Record<DiscoverAction["kind"], ActionExecutionTruth> = {
  fund: {
    badge: "USDC",
    detail: "Moves USDC from your wallet into this pool on Arc",
    arcSettlement: true,
  },
  sponsor: {
    badge: "USDC",
    detail: "Sponsor flow adds USDC to the program pool",
    arcSettlement: true,
  },
  claim: {
    badge: "Claim",
    detail: "Settles verified earnings to your wallet",
    arcSettlement: true,
  },
  create_program: {
    badge: "",
    detail: "Creates a payout rule for this community",
    arcSettlement: false,
  },
  install: {
    badge: "",
    detail: "One-time setup — syncs from Profile everywhere",
    arcSettlement: false,
  },
  connect_sensor: {
    badge: "",
    detail: "Link sources in Profile",
    arcSettlement: false,
  },
  console: {
    badge: "",
    detail: "Open community console on this page",
    arcSettlement: false,
  },
  automate: {
    badge: "",
    detail: "Pay automatically when verified activity arrives",
    arcSettlement: false,
  },
  open: {
    badge: "",
    detail: "View details",
    arcSettlement: false,
  },
  analyze: {
    badge: "",
    detail: "Review verified activity for this community",
    arcSettlement: false,
  },
  share: {
    badge: "",
    detail: "Copy settlement receipt",
    arcSettlement: false,
  },
};

export function actionExecutionTruth(kind: DiscoverAction["kind"]): ActionExecutionTruth {
  return TRUTH[kind] ?? { badge: "", detail: "", arcSettlement: false };
}

export const VALUE_GRAPH_AUDIENCES = [
  { id: "funder", label: "Funders", hint: "Fund pools — USDC on Arc" },
  { id: "creator", label: "Creators", hint: "Claim verified earnings" },
  { id: "operator", label: "Operators", hint: "Rules and auto-pay" },
] as const;

export const AUTOMATE_TAB = {
  label: "Auto-pay",
  hint: "Pay when verified activity arrives, up to your cap",
};
