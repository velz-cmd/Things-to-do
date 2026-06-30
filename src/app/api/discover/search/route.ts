import { NextResponse } from "next/server";
import { searchDiscover } from "@/lib/discover/search";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  try {
    const payload = await searchDiscover(q);
    return NextResponse.json(payload);
  } catch (e) {
    console.error("[discover/search]", e);
    return NextResponse.json({
      ok: true,
      results: [],
      topPrimaryAction: null,
      queueFilter: null,
    });
  }
}
