import { NextResponse } from "next/server";
import { verifyProof } from "@/lib/deputy/proof-engine";

export async function POST(req: Request) {
  const body = await req.json();
  const { type, category, payload, targetValueUsd } = body;

  if (!type || !category || !payload) {
    return NextResponse.json({ error: "Missing type, category, or payload" }, { status: 400 });
  }

  const result = verifyProof({
    type,
    source: body.source ?? "api",
    payload,
    category,
    targetValueUsd: Number(targetValueUsd ?? 0),
  });

  return NextResponse.json(result);
}
