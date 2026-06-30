export type CapitalWalletSource =
  | "circle_embedded"
  | "external_wallet"
  | "profile"
  | "server_wallet";

export type CapitalWalletResponse =
  | {
      ok: true;
      wallet: {
        address: string;
        shortAddress: string;
        source: CapitalWalletSource;
        externalAddress?: string;
      };
      balance: {
        totalUsdc: string;
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
    }
  | {
      ok: false;
      code: string;
      message: string;
      wallet?: {
        address: string;
        shortAddress: string;
        source: string;
      };
    };

export type WalletSyncState = "loading" | "synced" | "error" | "no_wallet";

export type WalletHealth = {
  address: string;
  shortAddress: string;
  source: string;
  chainId: number;
  blockNumber: number | null;
  syncedAt: string | null;
  rpcStatus: "live" | "error" | "syncing";
  nativeUsdc: string | null;
  erc20Usdc: string | null;
  externalAddress?: string;
};
