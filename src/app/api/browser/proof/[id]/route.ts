import { NextResponse } from "next/server";
import { loadProofArtifact } from "@/lib/browser/browser-proof";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const artifact = await loadProofArtifact(id);
  if (!artifact) {
    return NextResponse.json({ error: "Proof not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(artifact.buffer), {
    headers: {
      "Content-Type": artifact.mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
