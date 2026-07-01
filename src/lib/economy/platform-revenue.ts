import {
  RESOLVE_PLATFORM_FEE_BPS,
  RESOLVE_PLATFORM_WALLET,
} from "@/lib/payment/platform-fee";
import type { PlatformRevenueStream } from "./types";

export const PLATFORM_REVENUE_STREAMS: PlatformRevenueStream[] = [
  {
    id: "settlement_fee",
    label: "Settlement fee",
    model: "Basis points on program fulfill and on-chain settlement batches",
    defaultRate: `${RESOLVE_PLATFORM_FEE_BPS / 100}%`,
    envKey: "RESOLVE_PLATFORM_FEE_BPS",
    shipped: true,
  },
  {
    id: "x402_agent",
    label: "Agent signal commerce",
    model: "x402 USDC per micro-service; Circle facilitator routes payment to seller wallet",
    defaultRate: "Per catalog price ($0.001–$0.10) + settlement bps",
    envKey: "ARC_CLIENT_WALLET_ADDRESS",
    shipped: true,
  },
  {
    id: "operator_saas",
    label: "Operator SaaS",
    model: "Per active community install — settlement bps live; tiered SaaS manifest at GET /api/economy/operator/attach",
    defaultRate: "$0 starter · $49 operator · $199 network (billing next)",
    shipped: true,
  },
  {
    id: "company_reports",
    label: "Company / DAO reports",
    model: "Ledger-backed community export — authorizations, settlements, vitals",
    defaultRate: "GET /api/communities/{slug}/export",
    shipped: true,
  },
  {
    id: "api_usage",
    label: "Developer API",
    model: "Metered agent invoke + x402 per-request on Arc",
    defaultRate: "Catalog micro-prices via /api/agent/services",
    envKey: "ARC_CLIENT_WALLET_ADDRESS",
    shipped: true,
  },
  {
    id: "program_setup",
    label: "Program setup",
    model: "One-time fee for advanced templates (repayment, risk)",
    shipped: false,
  },
  {
    id: "repayment_pool_fee",
    label: "Repayment pool fee",
    model: "Small bps on waterfall inflows processed",
    shipped: false,
  },
  {
    id: "white_label",
    label: "White-label community pages",
    model: "Branded program and impact pages for enterprises",
    shipped: false,
  },
];

export function getPlatformFeeWallet(): string {
  return RESOLVE_PLATFORM_WALLET;
}

export function getActiveRevenueStreams(): PlatformRevenueStream[] {
  return PLATFORM_REVENUE_STREAMS.filter((s) => s.shipped);
}
