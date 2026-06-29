/**
 * Create Circle treasury wallets on Arc testnet (for Vercel env).
 *
 * Usage (on machine with CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET):
 *   CIRCLE_API_KEY=... CIRCLE_ENTITY_SECRET=... npx tsx scripts/setup-circle-treasury.ts
 *
 * Or on production (after Circle keys are in Vercel):
 *   curl -X POST https://resolve-task.vercel.app/api/cron/setup-circle-treasury \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
import { setupCircleTreasuryWallets } from "../src/lib/wallet/setup-treasury";

async function main() {
  const result = await setupCircleTreasuryWallets();

  console.log("\n✓ Circle treasury wallets created on Arc Testnet\n");
  console.log("Add these to Vercel → Settings → Environment Variables → Production:\n");
  for (const [key, value] of Object.entries(result.vercelEnv)) {
    console.log(`${key}=${value}`);
  }
  console.log("\nTreasury (fund this one):", result.clientWallet.address);
  console.log("Provider wallet:         ", result.providerWallet.address);
  console.log("\nFund USDC:", result.faucetUrl);
  console.log(result.message);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
