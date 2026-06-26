import { NextResponse } from "next/server";
import { getAuthorizationSummary } from "@/lib/authorization/ledger";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const missionId = searchParams.get("missionId");
  const connectorId = searchParams.get("connectorId") ?? undefined;

  if (missionId) {
    return NextResponse.json(await getAuthorizationSummary({ missionId, connectorId }));
  }

  if (owner && repo) {
    const summary = await getAuthorizationSummary({
      contextPrefix: `github-${owner}-${repo}-`,
      connectorId: connectorId ?? "github",
    });
    return NextResponse.json({
      ...summary,
      contributors: summary.authorizations.map((a) => ({
        login: a.payeeKey,
        amountUsd: a.amountUsd,
        status: a.status,
        connectorId: a.connectorId,
      })),
    });
  }

  return NextResponse.json({ error: "missionId or owner+repo required" }, { status: 400 });
}
