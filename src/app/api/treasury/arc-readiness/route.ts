import { NextResponse } from "next/server";
import { getArcReadiness } from "@/lib/treasury/arc-readiness";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requiredUsd = Number(searchParams.get("requiredUsd") ?? "0");
  const readiness = await getArcReadiness(
    Number.isFinite(requiredUsd) && requiredUsd > 0 ? requiredUsd : 0
  );
  return NextResponse.json(readiness);
}
