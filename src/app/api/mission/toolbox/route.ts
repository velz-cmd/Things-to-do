import { NextResponse } from "next/server";
import { gatherWorkspaceEvidence } from "@/lib/workspace/context";
import { buildToolboxSnapshot } from "@/lib/mission/toolbox/snapshot";

/** Capital infrastructure toolbox — projects, observatories, agents, vaults, etc. */
export async function GET() {
  const evidence = await gatherWorkspaceEvidence();
  const snapshot = buildToolboxSnapshot(evidence);
  return NextResponse.json({ ok: true, ...snapshot });
}
