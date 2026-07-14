export type CapitalWalletSelection = "app" | "connected";

export type ResolvedUserWallets = {
  appWallet: {
    walletId: string;
    address: `0x${string}`;
    provider: "circle_developer_controlled" | "circle_user_controlled" | "resolve";
  } | null;
  connectedWallet: {
    address: `0x${string}`;
    connector: "walletconnect" | "reown" | "injected" | "other";
  } | null;
  payoutWallet: {
    address: `0x${string}`;
    verificationState: "unverified" | "pending" | "verified";
  } | null;
  selectedCapitalWallet: CapitalWalletSelection;
  updatedAt: string;
};

type RegistryProfile = {
  walletAddress: string | null;
  scanWalletAddress: string | null;
  embeddedWallet: boolean;
  selectedCapitalWallet?: string | null;
  updatedAt: Date | string;
};

type PayoutRecord = {
  address: string;
  status: string;
} | null;

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;

function address(value: string | null | undefined): `0x${string}` | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && ADDRESS.test(normalized) ? (normalized as `0x${string}`) : null;
}

function payoutState(status: string): "unverified" | "pending" | "verified" {
  if (status === "verified") return "verified";
  if (status === "pending") return "pending";
  return "unverified";
}

/** Pure canonical mapping shared by Capital and Profile. It never provisions or substitutes wallets. */
export function resolveCanonicalWalletRegistry(input: {
  userId: string;
  profile: RegistryProfile;
  appWalletId?: string | null;
  appWalletProvider?: "circle" | "embedded" | null;
  connectedConnector?: "walletconnect" | "reown" | "injected" | "other";
  payoutDestination?: PayoutRecord;
}): ResolvedUserWallets {
  const appAddress = address(input.profile.walletAddress);
  const connectedAddress = address(input.profile.scanWalletAddress);
  const payoutAddress = address(input.payoutDestination?.address);
  const requestedSelection =
    input.profile.selectedCapitalWallet === "connected" ? "connected" : "app";
  const selectedCapitalWallet =
    requestedSelection === "connected" && connectedAddress ? "connected" : "app";

  return {
    appWallet: appAddress
      ? {
          walletId: input.appWalletId ?? appAddress,
          address: appAddress,
          provider:
            input.appWalletProvider === "circle"
              ? "circle_developer_controlled"
              : "resolve",
        }
      : null,
    connectedWallet: connectedAddress
      ? {
          address: connectedAddress,
          connector: input.connectedConnector ?? "reown",
        }
      : null,
    payoutWallet: payoutAddress
      ? {
          address: payoutAddress,
          verificationState: payoutState(input.payoutDestination?.status ?? "unverified"),
        }
      : null,
    selectedCapitalWallet,
    updatedAt:
      input.profile.updatedAt instanceof Date
        ? input.profile.updatedAt.toISOString()
        : input.profile.updatedAt,
  };
}
