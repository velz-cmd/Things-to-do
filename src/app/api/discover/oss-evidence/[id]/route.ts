import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadStoredOssOpportunities } from "@/lib/github/oss-scan-store";

function safeGitHubUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["github.com", "api.github.com"].includes(url.hostname)
      ? url
      : null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const normalizedId = decodeURIComponent(id);
  const evidence = await prisma.evidence.findUnique({ where: { id: normalizedId } }).catch(() => null);
  let destination = safeGitHubUrl(evidence?.sourceUrl);
  if (!destination) {
    const stored = await loadStoredOssOpportunities().catch(() => ({ opportunities: [], meta: null }));
    const record = stored.opportunities
      .flatMap((opportunity) => opportunity.activity?.records ?? [])
      .find((candidate) => candidate.id === normalizedId);
    destination = safeGitHubUrl(record?.sourceUrl);
  }
  if (!destination) {
    return NextResponse.json({ ok: false, error: "Verified GitHub evidence was not found." }, { status: 404 });
  }
  return NextResponse.redirect(destination, { status: 307 });
}
