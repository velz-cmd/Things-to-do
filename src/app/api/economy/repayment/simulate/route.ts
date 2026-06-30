import { NextResponse } from "next/server";
import {
  defaultRepaymentConfig,
  simulateRepaymentWaterfall,
} from "@/lib/economy/repayment-waterfall";

type SimulateBody = {
  principalUsd?: number;
  immediateCreatorPayoutUsd?: number;
  futureInflowsUsd?: number[];
  funderCapMultiplier?: number;
  inflowRepaymentBps?: number;
};

/**
 * Repayment waterfall simulator — Codex Repayment Engine preview.
 * POST /api/economy/repayment/simulate
 */
export async function POST(req: Request) {
  let body: SimulateBody = {};
  try {
    body = (await req.json()) as SimulateBody;
  } catch {
    body = {};
  }

  const principalUsd = Math.max(0, Number(body.principalUsd ?? 1000));
  const immediateCreatorPayoutUsd = Math.max(
    0,
    Number(body.immediateCreatorPayoutUsd ?? principalUsd * 0.85),
  );
  const futureInflowsUsd = Array.isArray(body.futureInflowsUsd)
    ? body.futureInflowsUsd.map((n) => Math.max(0, Number(n)))
    : [200, 350, 500, 120, 800];

  const config = defaultRepaymentConfig();
  if (body.funderCapMultiplier) {
    config.funderCapMultiplier = Math.max(1, Number(body.funderCapMultiplier));
  }
  if (body.inflowRepaymentBps) {
    config.inflowRepaymentBps = Math.min(10_000, Math.max(0, Number(body.inflowRepaymentBps)));
  }

  const result = simulateRepaymentWaterfall({
    principalUsd,
    immediateCreatorPayoutUsd,
    futureInflowsUsd,
    config,
  });

  return NextResponse.json({
    ok: true,
    input: { principalUsd, immediateCreatorPayoutUsd, futureInflowsUsd },
    config: {
      funderCapMultiplier: config.funderCapMultiplier,
      inflowRepaymentBps: config.inflowRepaymentBps,
      inflowSources: config.inflowSources,
    },
    result,
    example:
      "Funder seeds $1,000 → creators paid now → 15% of future OC/sponsor/API inflows repay funders until 1.5× cap → surplus to community",
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/economy/repayment/simulate",
    defaultConfig: defaultRepaymentConfig(),
    exampleBody: {
      principalUsd: 1000,
      immediateCreatorPayoutUsd: 850,
      futureInflowsUsd: [200, 350, 500, 120, 800],
      funderCapMultiplier: 1.5,
      inflowRepaymentBps: 1500,
    },
  });
}
