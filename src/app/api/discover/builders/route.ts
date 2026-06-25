import { NextResponse } from "next/server";
import { listHiddenBuilders } from "@/lib/weight/discovery";

/** Discovery engine — find unpaid value in open-source communities. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = searchParams.get("platform") ?? undefined;
  const minScore = searchParams.get("minScore");
  const builders = listHiddenBuilders({
    platform,
    minScore: minScore ? Number(minScore) : undefined,
  });

  return NextResponse.json({
    discovered: builders.length,
    builders,
    updatedAt: new Date().toISOString(),
    thesis: "Find who should be paid — before payments move",
  });
}
