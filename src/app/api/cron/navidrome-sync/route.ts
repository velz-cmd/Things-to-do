import { NextResponse } from "next/server";
import { syncNavidromeFromSqlite } from "@/lib/connectors/navidrome-sync";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncNavidromeFromSqlite();
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  return GET(req);
}
