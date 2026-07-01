import type { DiscoverAction } from "@/lib/discover/types";

export type ActionExecutionTruth = {
  /** Short badge on the button */
  badge: string;
  /** One line for tooltips / panel footer */
  detail: string;
  /** Whether this can move real Arc USDC when confirmed */
  arcSettlement: boolean;
};

const TRUTH: Record<DiscoverAction["kind"], ActionExecutionTruth> = {
  fund: {
    badge: "Arc USDC",
    detail: "Charges your Circle wallet on Arc — tx visible on Arcscan after confirm",
    arcSettlement: true,
  },
  sponsor: {
    badge: "Arc USDC",
    detail: "Sponsor flow posts real USDC from your wallet to the program pool",
    arcSettlement: true,
  },
  claim: {
    badge: "Arc claim",
    detail: "Settles verified ledger authorizations to your wallet on Arc",
    arcSettlement: true,
  },
  create_program: {
    badge: "Creates program",
    detail: "Writes a funded program in your account — capital moves when you fund it",
    arcSettlement: false,
  },
  install: {
    badge: "Install + sync",
    detail: "Installs community and starts background sensor sync — no charge",
    arcSettlement: false,
  },
  connect_sensor: {
    badge: "Install + sync",
    detail: "Installs community rail — sensors sync in background",
    arcSettlement: false,
  },
  console: {
    badge: "Console",
    detail: "Opens your community console on Discover — sensors and funding stay inline",
    arcSettlement: false,
  },
  automate: {
    badge: "Auto-pay rule",
    detail: "Saves a when-proof-arrives rule — Arc pays only after a verified event fires",
    arcSettlement: false,
  },
  open: {
    badge: "View",
    detail: "Opens entity or section — read-only navigation",
    arcSettlement: false,
  },
  analyze: {
    badge: "Agent",
    detail: "Runs Mission agent (may charge prepaid USDC if configured)",
    arcSettlement: false,
  },
  share: {
    badge: "Receipt",
    detail: "Copies a verified receipt link from the ledger",
    arcSettlement: false,
  },
};

export function actionExecutionTruth(kind: DiscoverAction["kind"]): ActionExecutionTruth {
  return TRUTH[kind] ?? { badge: "Action", detail: "Runs in Discover", arcSettlement: false };
}

/** Who the value graph is designed for — shown as legend. */
export const VALUE_GRAPH_AUDIENCES = [
  {
    id: "funder",
    label: "Funders",
    hint: "Click gaps · Fund / Sponsor moves Arc USDC",
  },
  {
    id: "creator",
    label: "Creators",
    hint: "Person / artist bubbles · Claim when ledger shows earnings",
  },
  {
    id: "operator",
    label: "Operators",
    hint: "Community bubbles · Install rails + auto-pay rules",
  },
] as const;

export const AUTOMATE_TAB = {
  label: "Auto-pay",
  hint: "When a sensor proves work (merge, play, watch), pay automatically up to your cap",
};
