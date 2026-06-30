import { NextResponse } from "next/server";
import {
  buildEconomicInfrastructureManifest,
  buildInfrastructureSummary,
} from "@/lib/economy/manifest";

/**
 * Public economic infrastructure manifest — for stack page, developers, and judges.
 * GET /api/economy/infrastructure
 */
export async function GET() {
  const manifest = buildEconomicInfrastructureManifest();
  const summary = buildInfrastructureSummary();

  return NextResponse.json({
    ok: true,
    ...manifest,
    summary,
    docs: "/docs/ECONOMIC-INFRASTRUCTURE.md",
  });
}
