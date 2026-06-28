import { NextResponse } from "next/server";
import { buildEntitySurface } from "@/lib/entity/surface";
import { entityPathToId } from "@/lib/entity/paths";

type Params = { params: Promise<{ parts: string[] }> };

export async function GET(_req: Request, { params }: Params) {
  const { parts } = await params;
  const entityId = entityPathToId(parts ?? []);
  if (!entityId) {
    return NextResponse.json({ ok: false, error: "Invalid entity path" }, { status: 400 });
  }

  const surface = await buildEntitySurface(entityId);
  if (!surface) {
    return NextResponse.json({ ok: false, error: "Entity not found" }, { status: 404 });
  }

  return NextResponse.json(surface);
}
