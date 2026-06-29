import { NextResponse } from "next/server";
import { getProductionDemoReadiness } from "@/lib/demo/production-readiness";

/** Lepton / external-user demo checklist — honest ops status, no secrets. */
export async function GET() {
  const readiness = await getProductionDemoReadiness();
  return NextResponse.json(readiness);
}
