import { sendBatchMemoPayouts } from "@/lib/arc/memo";
import { fulfillMissionAuthorizations } from "@/lib/authorization/ledger";
import { assertTreasuryCanFund } from "@/lib/treasury/engine";
import { isLiveArcEnabled } from "@/lib/settlement/arc-config";
import type { PayoutCurrency } from "@/lib/settlement/fx";

export type GlobalPayoutLine = {
  payeeKeyType: string;
  payeeKey: string;
  wallet: string;
  amountUsd: number;
  payeeName?: string | null;
  payoutCurrency?: PayoutCurrency;
};

export type GlobalSettlementInput = {
  missionId: string;
  settlementId: string;
  batchId: string;
  payouts: GlobalPayoutLine[];
  settledPayeeKeys: { payeeKeyType: string; payeeKey: string; walletAddress?: string }[];
  claimablePayeeKeys: { payeeKeyType: string; payeeKey: string }[];
};

export type GlobalSettlementResult = {
  mode: "onchain" | "offchain";
  txHashes: string[];
  payoutCount: number;
  totalUsd: number;
};

/**
 * Circle Arc global settlement layer — one treasury funding, batched memo payouts.
 * Founder funds once in USDC; contributors claim in USDC and optionally swap to EURC/cirBTC.
 */
export async function executeGlobalBatchSettlement(
  input: GlobalSettlementInput,
): Promise<GlobalSettlementResult> {
  const totalUsd = input.payouts.reduce((s, p) => s + p.amountUsd, 0);
  const funding = await assertTreasuryCanFund(totalUsd);

  let txHashes: string[] = [];
  let mode: GlobalSettlementResult["mode"] = "offchain";

  if (
    funding.mode === "onchain" &&
    isLiveArcEnabled() &&
    input.payouts.length > 0
  ) {
    const memoResults = await sendBatchMemoPayouts({
      batchId: input.batchId,
      payouts: input.payouts.map((p) => ({
        wallet: p.wallet,
        amountUsd: p.amountUsd,
        payeeName: p.payeeName ?? p.payeeKey,
      })),
    });
    txHashes = memoResults.map((r) => r.txHash);
    mode = "onchain";
  }

  await fulfillMissionAuthorizations({
    missionId: input.missionId,
    settlementId: input.settlementId,
    settledPayeeKeys: input.settledPayeeKeys,
    claimablePayeeKeys: input.claimablePayeeKeys,
  });

  return {
    mode,
    txHashes,
    payoutCount: input.payouts.length,
    totalUsd: Math.round(totalUsd * 100) / 100,
  };
}
