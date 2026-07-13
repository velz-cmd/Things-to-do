import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function persistWebhookEvent(input: {
  provider: string;
  providerEventId: string;
  eventType: string;
  signatureValid: boolean;
  payload: Prisma.InputJsonValue;
}) {
  try {
    const event = await prisma.webhookEvent.create({ data: input });
    return { event, duplicate: false };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const event = await prisma.webhookEvent.findUniqueOrThrow({
      where: {
        provider_providerEventId: {
          provider: input.provider,
          providerEventId: input.providerEventId,
        },
      },
    });
    return { event, duplicate: true };
  }
}

export async function markWebhookProcessed(id: string): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id },
    data: { status: "processed", processedAt: new Date(), errorMessage: null },
  });
}

export async function markWebhookFailed(id: string, error: unknown): Promise<void> {
  await prisma.webhookEvent.update({
    where: { id },
    data: {
      status: "failed",
      errorMessage: error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000),
    },
  });
}
