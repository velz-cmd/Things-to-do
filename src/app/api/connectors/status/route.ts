import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getConnectorStatuses } from "@/lib/connectors/connector-service";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const userId = await getSessionUserId();
  const connectors = await getConnectorStatuses(userId, category ?? undefined);
  return NextResponse.json({ connectors });
}
