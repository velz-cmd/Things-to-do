import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";

export type CapitalFlowSnapshot = {
  treasuryBalanceUsd: number;
  obligationsUsd: number;
  availableUsd: number;
  participantCount: number;
  /** Arc memo batches — sub-cent per payee at scale */
  estimatedBatchFeeUsd: number;
  canRouteGlobally: boolean;
  scaleMessage: string;
};

/**
 * Capital Flow Engine — extends settlement with treasury routing at scale.
 * One treasury → policy → N participants → one Arc batch.
 */
export async function getCapitalFlowSnapshot(
  participantCount = 0,
): Promise<CapitalFlowSnapshot> {
  const [treasury, ledger] = await Promise.all([
    getTreasurySnapshot(),
    getGlobalAuthorizationSummary().catch(() => null),
  ]);

  const count = participantCount || ledger?.count || 0;
  const estimatedBatchFeeUsd = Math.max(0.01, count * 0.0001);

  return {
    treasuryBalanceUsd: treasury.balanceUsd,
    obligationsUsd: treasury.obligationsUsd,
    availableUsd: treasury.availableUsd,
    participantCount: count,
    estimatedBatchFeeUsd: Math.round(estimatedBatchFeeUsd * 100) / 100,
    canRouteGlobally: treasury.canSettleGlobally,
    scaleMessage:
      count > 0
        ? `Route ${count.toLocaleString()} participants in one batched Arc settlement (~$${estimatedBatchFeeUsd.toFixed(2)} est. fees)`
        : "Fund once — batch pay contributors, maintainers, and artists worldwide",
  };
}
