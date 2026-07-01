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
    model: "Monthly per active community install with sensors",
    defaultRate: "TBD tiered",
    shipped: false,
  },
  {
    id: "company_reports",
    label: "Company / DAO reports",
    model: "Premium dependency risk and compliance exports",
    defaultRate: "Per report or annual",
    shipped: false,
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
