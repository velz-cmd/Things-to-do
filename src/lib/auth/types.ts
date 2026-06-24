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
  /** Primary RESOLVE app wallet — persistent per account */
  appWalletAddress?: string;
  /** User-connected MetaMask/Rabby wallet */
  externalWalletAddress?: string;
  walletAddress?: string;
  wallets: ResolveWallet[];
  displayName?: string;
  avatarUrl?: string;
  /** Signed in with Google/email (identity) */
  accountVerified: boolean;
  /** Gmail inbox API for receipts (optional, separate from sign-in) */
  gmailInboxConnected: boolean;
  arcConnected: boolean;
  appWalletPending: boolean;
  appWalletProvider?: "circle" | "embedded";
  loading: boolean;
};
