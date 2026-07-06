export type CapitalWalletSource =
  | "circle_embedded"
  | "external_wallet"
  | "profile"
  | "server_wallet";

export type CapitalWalletActivity = {
  id: string;
  label: string;
  amountUsd: number | null;
  status: string;
  createdAt: string;
  kind: string;
  method?: string | null;
};

export type CapitalWalletResponse =
  | {
      ok: true;
      wallet: {
        address: string;
        shortAddress: string;
        source: CapitalWalletSource;
        provider?: "circle" | "embedded";
        externalAddress?: string;
      };
      balance: {
        totalUsdc: string;
        onChainUsd?: string;
        nativeUsdc: string;
        erc20Usdc: string;
        chainId: number;
        blockNumber: number;
        syncedAt: string;
        reservedUsd: number;
        spendableUsd: string;
      };
      account: {
        email: string | null;
        displayName: string | null;
      } | null;
      warnings: string[];
      syncStatus?: "live" | "cached" | "syncing" | "error" | "unknown" | "no_wallet";
      syncError?: string | null;
      lastKnownBalance?: number | null;
      activity?: CapitalWalletActivity[];
    }
  | {
      ok: false;
      code: string;
      message: string;
      wallet?: {
        address: string;
        shortAddress: string;
        source: string;
        provider?: "circle" | "embedded";
      };
    };

export type WalletSyncState = "loading" | "synced" | "cached" | "error" | "no_wallet";

export type WalletHealth = {
  address: string;
  shortAddress: string;
  source: string;
  chainId: number;
  blockNumber: number | null;
  syncedAt: string | null;
  rpcStatus: "live" | "cached" | "error" | "syncing";
  nativeUsdc: string | null;
  erc20Usdc: string | null;
  externalAddress?: string;
};
