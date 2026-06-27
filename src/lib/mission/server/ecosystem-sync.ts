import { createEcosystem, ensureSeedEcosystems } from "@/lib/mission/server/ecosystems";
import { prisma } from "@/lib/db";

type LocalEcosystem = {
  id: string;
  name: string;
  kind?: string;
  keywords?: string[];
};

/** Seed default workspaces and import any guest localStorage ecosystems once per user. */
export async function syncUserEcosystems(
  userId: string,
  localEcosystems: LocalEcosystem[] = [],
): Promise<void> {
  await ensureSeedEcosystems(userId);

  for (const eco of localEcosystems) {
    const name = eco.name?.trim();
    if (!name) continue;

    const existing = await prisma.resolveEcosystem.findUnique({
      where: { userId_name: { userId, name } },
    });
    if (existing) continue;

    await createEcosystem(userId, name, eco.kind ?? "organization");
  }
}
