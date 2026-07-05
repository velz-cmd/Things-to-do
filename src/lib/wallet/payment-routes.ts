import { RESOLVE_PLATFORM_WALLET } from "@/lib/payment/platform-fee";
import {
  ARC_CLIENT_WALLET_ADDRESS,
  ARC_PROVIDER_WALLET_ADDRESS,
} from "@/lib/settlement/arc-config";

/** On-chain payment destinations keyed by user action — server source of truth. */
export type WalletPaymentAction =
  | "deposit"
  | "program_fund"
  | "agent_signal";

export type PaymentRouteKind = "identity" | "treasury" | "agent";

export type PaymentRoute = {
  action: WalletPaymentAction;
  kind: PaymentRouteKind;
  address: string;
  label: string;
};

export type PaymentRouteResult = PaymentRoute | { error: string };

/**
 * Resolve where Arc USDC should be sent for a given action.
 * - deposit → user's RESOLVE (Circle) identity wallet
 * - program_fund → settlement treasury (ARC_CLIENT_WALLET_ADDRESS)
 * - agent_signal → platform / provider agent wallet
 */
export function resolvePaymentRoute(
  action: WalletPaymentAction,
  userIdentityAddress?: string | null,
): PaymentRouteResult {
  switch (action) {
    case "deposit": {
      if (!userIdentityAddress?.trim()) {
        return { error: "RESOLVE wallet not ready — wait a moment and retry" };
      }
      return {
        action,
        kind: "identity",
        address: userIdentityAddress,
        label: "Your RESOLVE wallet",
      };
    }
    case "program_fund": {
      const treasury = ARC_CLIENT_WALLET_ADDRESS?.trim();
      if (treasury) {
        return {
          action,
          kind: "treasury",
          address: treasury,
          label: "RESOLVE settlement treasury",
        };
      }
      if (userIdentityAddress?.trim()) {
        return {
          action,
          kind: "identity",
          address: userIdentityAddress,
          label: "Your RESOLVE wallet (treasury not configured)",
        };
      }
      return {
        error:
          "Settlement treasury not configured — set ARC_CLIENT_WALLET_ADDRESS on the server",
      };
    }
    case "agent_signal": {
      const agent =
        RESOLVE_PLATFORM_WALLET?.trim() ?? ARC_PROVIDER_WALLET_ADDRESS?.trim();
      if (!agent) {
        return {
          error:
            "Agent settlement wallet not configured — set RESOLVE_PLATFORM_FEE_WALLET or ARC_PROVIDER_WALLET_ADDRESS",
        };
      }
      return {
        action,
        kind: "agent",
        address: agent,
        label: "RESOLVE agent settlement",
      };
    }
    default: {
      const _exhaustive: never = action;
      return { error: `Unknown payment action: ${_exhaustive}` };
    }
  }
}
