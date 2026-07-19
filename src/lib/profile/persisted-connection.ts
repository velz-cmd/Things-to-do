import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Canonical persisted Profile connection read by every product tab. */
export async function persistProfileConnection(input: {
  userId: string;
  provider: string;
  displayLabel: string;
  capabilities?: Prisma.InputJsonValue;
}) {
  const externalAccountId = `${input.userId}:profile:${input.provider}`;
  return prisma.sourceConnection.upsert({
    where: {
      userId_provider_externalAccountId: {
        userId: input.userId,
        provider: input.provider,
        externalAccountId,
      },
    },
    create: {
      userId: input.userId,
      provider: input.provider,
      externalAccountId,
      displayLabel: input.displayLabel,
      status: "connected",
      capabilitiesJson: input.capabilities ?? { readEvidence: true, synchronize: true },
    },
    update: {
      displayLabel: input.displayLabel,
      status: "connected",
      authExpiresAt: null,
      capabilitiesJson: input.capabilities ?? { readEvidence: true, synchronize: true },
    },
  });
}
