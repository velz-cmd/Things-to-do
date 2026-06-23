export type ConnectorId =
  | "gmail"
  | "arc"
  | "circle"
  | "browser"
  | "resend"
  | "finance"
  | "flight"
  | "parcel"
  | "wallet";

export type ConnectorState =
  | "connected"
  | "ready"
  | "missing"
  | "needs_auth"
  | "error";

export interface ConnectorStatus {
  id: ConnectorId;
  label: string;
  state: ConnectorState;
  requiredFor: string[];
  lastCheckedAt?: string;
  error?: string;
  hint?: string;
}

export type TaskCategory =
  | "airline_refund"
  | "subscription_cancellation"
  | "parcel_claim"
  | "wallet_guardian"
  | "charge_dispute"
  | "money_recovery"
  | "subscription"
  | "manual";

export const CATEGORY_CONNECTORS: Record<
  string,
  { required: ConnectorId[]; optional: ConnectorId[] }
> = {
  airline_refund: {
    required: ["gmail", "browser", "arc"],
    optional: ["flight", "resend"],
  },
  subscription_cancellation: {
    required: ["gmail", "browser", "arc"],
    optional: ["finance", "resend"],
  },
  parcel_claim: {
    required: ["browser", "arc"],
    optional: ["parcel", "gmail", "resend"],
  },
  wallet_guardian: {
    required: ["wallet", "arc"],
    optional: ["circle"],
  },
  charge_dispute: {
    required: ["gmail", "browser", "arc"],
    optional: ["finance"],
  },
  money_recovery: {
    required: ["browser", "arc"],
    optional: ["gmail", "resend"],
  },
  subscription: {
    required: ["gmail", "browser", "arc"],
    optional: ["finance"],
  },
  manual: {
    required: ["browser", "arc"],
    optional: ["gmail", "finance", "wallet"],
  },
};
