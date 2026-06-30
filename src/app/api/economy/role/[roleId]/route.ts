import { NextResponse } from "next/server";
import { buildRoleWorkbench, listProfessionalRoles } from "@/lib/economy/actor-routing";
import { buildInfrastructureSummary } from "@/lib/economy/manifest";
import type { EcosystemRoleId } from "@/lib/capital/ecosystem-program";

const VALID_ROLES = new Set<string>([
  ...listProfessionalRoles(),
  "audience",
]);

type RoleParam = EcosystemRoleId | "dao";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ roleId: string }> },
) {
  const { roleId } = await params;
  if (!VALID_ROLES.has(roleId as RoleParam)) {
    return NextResponse.json({ error: "Unknown role" }, { status: 404 });
  }

  const workbench = buildRoleWorkbench(roleId as RoleParam);
  const summary = buildInfrastructureSummary();

  return NextResponse.json({
    ok: true,
    role: workbench,
    infrastructure: summary,
  });
}
