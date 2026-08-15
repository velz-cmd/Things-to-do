/**
 * Read-only Arc/Circle production readiness check. Moves no funds.
 * Verifies Circle credentials are functional and the configured Arc
 * client/provider wallets actually exist and report a balance, before
 * anyone flips ARC_ERC8183_ENABLED. Deliberately avoids importing
 * src/lib/settlement/circle-client.ts because its import chain pulls in
 * src/lib/db.ts ("server-only"), which throws outside the Next.js server
 * runtime.
 */
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import { normalizeCircleEntitySecret } from "../src/lib/wallet/circle-secret";
import {
  ARC_CHAIN_ID,
  ARC_CLIENT_WALLET_ID,
  ARC_PROVIDER_WALLET_ID,
  ARC_CLIENT_WALLET_ADDRESS,
  ARC_PROVIDER_WALLET_ADDRESS,
  hasCircleCredentials,
} from "../src/lib/settlement/arc-config";

async function main() {
  console.log("chainId:", ARC_CHAIN_ID);
  console.log("hasCircleCredentials:", hasCircleCredentials());
  console.log("clientWalletId set:", Boolean(ARC_CLIENT_WALLET_ID));
  console.log("providerWalletId set:", Boolean(ARC_PROVIDER_WALLET_ID));
  console.log("clientWalletAddress:", ARC_CLIENT_WALLET_ADDRESS);
  console.log("providerWalletAddress:", ARC_PROVIDER_WALLET_ADDRESS);

  const apiKey = process.env.CIRCLE_API_KEY?.trim();
  const entitySecret = normalizeCircleEntitySecret(process.env.CIRCLE_ENTITY_SECRET);
  if (!apiKey || !entitySecret) {
    console.log("BLOCKED: CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET missing/invalid.");
    process.exit(1);
  }

  const circle = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  for (const [label, walletId] of [
    ["client", ARC_CLIENT_WALLET_ID],
    ["provider", ARC_PROVIDER_WALLET_ID],
  ] as const) {
    if (!walletId) {
      console.log(`${label}: no walletId configured`);
      continue;
    }
    try {
      const wallet = await circle.getWallet({ id: walletId });
      console.log(`${label} wallet:`, {
        id: wallet.data?.wallet?.id,
        address: wallet.data?.wallet?.address,
        blockchain: wallet.data?.wallet?.blockchain,
        state: wallet.data?.wallet?.state,
      });
      const balances = await circle.getWalletTokenBalance({ id: walletId });
      console.log(
        `${label} balances:`,
        balances.data?.tokenBalances?.map((b) => ({
          token: b.token?.symbol,
          amount: b.amount,
        })),
      );
    } catch (err) {
      console.log(`${label} wallet check FAILED:`, (err as Error).message);
    }
  }
}

main().catch((err) => {
  console.error("verify-arc-live-readiness failed:", err);
  process.exit(1);
});
