import { NextResponse } from "next/server";
import { getTreasuryStats } from "@/lib/treasury/distribute";
import { seedContributorRegistry } from "@/lib/registry/seed";

export async function GET() {
  const stats = await getTreasuryStats();
  return NextResponse.json(stats);
}

export async function POST() {
  const seeded = await seedContributorRegistry();
  return NextResponse.json({ ok: true, seeded });
}
