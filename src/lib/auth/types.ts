export type ResolveWallet = {
  id: string;
  type: "app_managed" | "external";
  chain: "evm";
  address: string;
  provider?: string;
  isPrimary: boolean;
  createdAt: string;
};

export type ResolveAuthMethod =
  | "email"
  | "google"
  | "wallet"
  | "both"
  | "none";

export type AccountMode =
  | "none"
  | "guest"
  | "wallet"
  | "email"
  | "google"
  | "both";

export type ResolveAccountState = {
  isAuthenticated: boolean;
  mode: AccountMode;
  authMethod: ResolveAuthMethod;
  email?: string;
  notificationEmail?: string;
  notificationEmailVerified: boolean;
  walletAddress?: string;
  wallets: ResolveWallet[];
  displayName?: string;
  avatarUrl?: string;
  gmailConnected: boolean;
  arcConnected: boolean;
  appWalletPending: boolean;
  loading: boolean;
};
