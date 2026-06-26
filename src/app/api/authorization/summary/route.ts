import { NextResponse } from "next/server";
import { getAuthorizationSummaryForRepo } from "@/lib/authorization/ledger";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
  }

  const summary = await getAuthorizationSummaryForRepo(owner, repo);
  return NextResponse.json(summary);
}
