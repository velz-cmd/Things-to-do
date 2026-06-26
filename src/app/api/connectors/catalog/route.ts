import { NextResponse } from "next/server";
import { CONNECTOR_CATALOG } from "@/lib/connectors/types";

export async function GET() {
  return NextResponse.json({ connectors: CONNECTOR_CATALOG });
}
