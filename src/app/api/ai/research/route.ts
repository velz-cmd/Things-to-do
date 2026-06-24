import { NextResponse } from "next/server";
import { analyzeGithubContext } from "@/lib/ai/research";

export async function POST(req: Request) {
  const body = await req.json();
  const repoFullName = String(body.repoFullName ?? body.repository ?? "").trim();
  if (!repoFullName) {
    return NextResponse.json({ error: "repoFullName required" }, { status: 400 });
  }

  const result = await analyzeGithubContext({
    repoFullName,
    prTitle: body.prTitle ? String(body.prTitle) : undefined,
    prBody: body.prBody ? String(body.prBody) : undefined,
  });

  if (!result) {
    return NextResponse.json({ error: "Research layer unavailable" }, { status: 503 });
  }

  return NextResponse.json(result);
}
