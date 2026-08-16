import { NextResponse } from "next/server";
import {
  ensureFundStakeArcSchema,
  fundStakeProvenanceAvailable,
} from "@/lib/db/ensure-fund-stake-arc-schema";
import { requireReadyUser } from "@/lib/auth/session";

/**
 * Applies the fund-stake provenance columns.
 *
 * DDL lives here rather than in the funding path: an ALTER TABLE inside a
 * request that moves money turned settled transfers into 500s. This route is
 * idempotent and safe to call repeatedly.
 */
export async function POST() {
  const ready = await requireReadyUser();
  if ("error" in ready) {
    return NextResponse.json({ error: ready.error }, { status: ready.status });
  }
  const applied = await ensureFundStakeArcSchema();
  return NextResponse.json({
    ok: applied,
    columnsAvailable: await fundStakeProvenanceAvailable(),
  });
}
