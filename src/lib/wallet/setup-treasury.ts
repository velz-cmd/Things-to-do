import { randomUUID } from "crypto";
import {
  ensureCircleEntitySecret,
  ensureCircleWalletSet,
  getCircleWalletSetId,
} from "@/lib/wallet/circle-config";
import { getCircleClient } from "@/lib/settlement/circle-client";

export type TreasuryWalletSetup = {
  ok: boolean;
  walletSetId: string;
  clientWallet: {
    id: string;
    address: string;
  };
  providerWallet: {
    id: string;
    address: string;
  };
  vercelEnv: Record<string, string>;
  faucetUrl: string;
  message: string;
};

async function createArcWallet(
  walletSetId: string,
  idempotencyKey: string,
  label: string,
) {
  const circle = await getCircleClient();
  if (!circle) throw new Error("Circle client not configured");

  const res = await circle.createWallets({
    walletSetId,
    blockchains: ["ARC-TESTNET"],
    count: 1,
    accountType: "EOA",
    idempotencyKey,
  });

  const wallet = res.data?.wallets?.[0];
  if (!wallet?.id || !wallet.address) {
    throw new Error(`Failed to create ${label} wallet`);
  }

  return { id: wallet.id, address: wallet.address };
}

/** Create Circle treasury + provider wallets on Arc testnet for Vercel env. */
export async function setupCircleTreasuryWallets(): Promise<TreasuryWalletSetup> {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("CIRCLE_API_KEY is not set — add it in Vercel first");
  }

  await ensureCircleEntitySecret();
  let walletSetId = await getCircleWalletSetId();
  if (!walletSetId) {
    const boot = await ensureCircleWalletSet();
    walletSetId = boot.walletSetId;
  }

  const clientWallet = await createArcWallet(
    walletSetId,
    "resolve-treasury-client-v1",
    "RESOLVE Treasury",
  );
  const providerWallet = await createArcWallet(
    walletSetId,
    "resolve-treasury-provider-v1",
    "RESOLVE Provider",
  );

  const vercelEnv = {
    CIRCLE_WALLET_SET_ID: walletSetId,
    ARC_CLIENT_WALLET_ID: clientWallet.id,
    ARC_CLIENT_WALLET_ADDRESS: clientWallet.address,
    ARC_PROVIDER_WALLET_ADDRESS: providerWallet.address,
    ARC_PROVIDER_WALLET_ID: providerWallet.id,
  };

  return {
    ok: true,
    walletSetId,
    clientWallet,
    providerWallet,
    vercelEnv,
    faucetUrl: "https://faucet.circle.com",
    message:
      "Add the vercelEnv values to Vercel Production, redeploy, then fund ARC_CLIENT_WALLET_ADDRESS on the Arc testnet faucet.",
  };
}

export async function setupCircleTreasuryWalletsFresh(): Promise<TreasuryWalletSetup> {
  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  if (!apiKey) throw new Error("CIRCLE_API_KEY is not set");

  await ensureCircleEntitySecret();
  const boot = await ensureCircleWalletSet();
  const walletSetId = boot.walletSetId;

  const clientWallet = await createArcWallet(
    walletSetId,
    `resolve-treasury-client-${randomUUID()}`,
    "RESOLVE Treasury",
  );
  const providerWallet = await createArcWallet(
    walletSetId,
    `resolve-treasury-provider-${randomUUID()}`,
    "RESOLVE Provider",
  );

  return {
    ok: true,
    walletSetId,
    clientWallet,
    providerWallet,
    vercelEnv: {
      CIRCLE_WALLET_SET_ID: walletSetId,
      ARC_CLIENT_WALLET_ID: clientWallet.id,
      ARC_CLIENT_WALLET_ADDRESS: clientWallet.address,
      ARC_PROVIDER_WALLET_ADDRESS: providerWallet.address,
      ARC_PROVIDER_WALLET_ID: providerWallet.id,
    },
    faucetUrl: "https://faucet.circle.com",
    message: "Fresh treasury wallets created — update Vercel and fund the client wallet.",
  };
}
