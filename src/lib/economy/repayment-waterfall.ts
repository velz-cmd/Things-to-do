import type {
  RepaymentProgramConfig,
  RepaymentWaterfallTier,
} from "./types";
import {
  DEFAULT_REPAYMENT_BPS,
  DEFAULT_REPAYMENT_CAP_MULTIPLIER,
} from "./capital-modes";

export const STANDARD_REPAYMENT_WATERFALL: RepaymentWaterfallTier[] = [
  {
    id: "creators-now",
    label: "Creators paid immediately",
    shareBps: 10_000,
    recipient: "creators",
  },
  {
    id: "funder-repay",
    label: "Funder repayment from future inflows",
    shareBps: DEFAULT_REPAYMENT_BPS,
    recipient: "funders",
    capMultiplier: DEFAULT_REPAYMENT_CAP_MULTIPLIER,
  },
  {
    id: "community-surplus",
    label: "Surplus to community after cap",
    shareBps: 10_000,
    recipient: "community",
  },
];

export function defaultRepaymentConfig(): RepaymentProgramConfig {
  return {
    enabled: true,
    funderCapMultiplier: DEFAULT_REPAYMENT_CAP_MULTIPLIER,
    inflowRepaymentBps: DEFAULT_REPAYMENT_BPS,
    inflowSources: [
      "opencollective",
      "github_sponsors",
      "sponsorship",
      "api_revenue",
      "donations",
      "protocol_treasury",
      "settlement_surplus",
    ],
    waterfall: STANDARD_REPAYMENT_WATERFALL,
  };
}

export type WaterfallSimulationInput = {
  principalUsd: number;
  immediateCreatorPayoutUsd: number;
  futureInflowsUsd: number[];
  config?: RepaymentProgramConfig;
};

export type WaterfallSimulationResult = {
  creatorsPaidUsd: number;
  funderRepaidUsd: number;
  funderRemainingCapUsd: number;
  communitySurplusUsd: number;
  platformFeeUsd: number;
  capReached: boolean;
  ledger: Array<{
    inflowUsd: number;
    toCreatorsUsd: number;
    toFundersUsd: number;
    toCommunityUsd: number;
  }>;
};

/**
 * Simulate repayment waterfall — creators paid now; funders repay from future inflows until cap.
 * Not fake ROI: capped, programmable, tied to real inflow sources.
 */
export function simulateRepaymentWaterfall(
  input: WaterfallSimulationInput,
): WaterfallSimulationResult {
  const config = input.config ?? defaultRepaymentConfig();
  const capUsd = input.principalUsd * config.funderCapMultiplier;
  const repayBps = config.inflowRepaymentBps;

  let funderRepaidUsd = 0;
  let communitySurplusUsd = 0;
  const ledger: WaterfallSimulationResult["ledger"] = [];

  const creatorsPaidUsd = input.immediateCreatorPayoutUsd;

  for (const inflowUsd of input.futureInflowsUsd) {
    if (inflowUsd <= 0) continue;

    let toFundersUsd = 0;
    let toCommunityUsd = 0;
    let toCreatorsUsd = 0;

    const remainingCap = Math.max(0, capUsd - funderRepaidUsd);

    if (remainingCap > 0) {
      const repaySlice = (inflowUsd * repayBps) / 10_000;
      toFundersUsd = Math.min(repaySlice, remainingCap);
      funderRepaidUsd += toFundersUsd;
    }

    const remainder = inflowUsd - toFundersUsd;
    if (funderRepaidUsd >= capUsd - 1e-9) {
      toCommunityUsd = remainder;
      communitySurplusUsd += remainder;
    } else {
      toCreatorsUsd = remainder;
    }

    ledger.push({
      inflowUsd,
      toCreatorsUsd,
      toFundersUsd,
      toCommunityUsd,
    });
  }

  return {
    creatorsPaidUsd,
    funderRepaidUsd: roundUsd(funderRepaidUsd),
    funderRemainingCapUsd: roundUsd(Math.max(0, capUsd - funderRepaidUsd)),
    communitySurplusUsd: roundUsd(communitySurplusUsd),
    platformFeeUsd: 0,
    capReached: funderRepaidUsd >= capUsd - 1e-9,
    ledger,
  };
}

function roundUsd(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
