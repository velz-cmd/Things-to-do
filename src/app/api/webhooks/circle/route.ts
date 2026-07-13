import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { appendOperationalEvent } from "@/lib/events/operational-event";
import {
  markWebhookProcessed,
  persistWebhookEvent,
} from "@/lib/webhooks/persist";
import { verifyCircleWebhookSignature } from "@/lib/webhooks/circle-signature";

export const runtime = "nodejs";

const envelopeSchema = z
  .object({
    notificationId: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    notificationType: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
  })
  .passthrough();

export async function POST(request: Request) {
  const rawBody = await request.text();
  const keyId = request.headers.get("x-circle-key-id");
  const signature = request.headers.get("x-circle-signature");
  if (!keyId || !signature) {
    return NextResponse.json({ error: "Missing Circle signature headers." }, { status: 401 });
  }

  let signatureValid = false;
  try {
    signatureValid = await verifyCircleWebhookSignature({ rawBody, keyId, signature });
  } catch (error) {
    console.warn("[circle-webhook] signature verification unavailable", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (!signatureValid) {
    return NextResponse.json({ error: "Invalid Circle webhook signature." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = envelopeSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Circle notification envelope." }, { status: 400 });
  }

  const providerEventId = parsed.data.notificationId ?? parsed.data.id;
  const eventType = parsed.data.notificationType ?? parsed.data.type;
  if (!providerEventId || !eventType) {
    return NextResponse.json({ error: "Circle notification ID and type are required." }, { status: 400 });
  }

  const jsonPayload = JSON.parse(rawBody) as Prisma.InputJsonValue;
  const { event, duplicate } = await persistWebhookEvent({
    provider: "circle",
    providerEventId,
    eventType,
    signatureValid,
    payload: jsonPayload,
  });

  if (!duplicate) {
    await appendOperationalEvent({
      eventType: `circle.${eventType}`,
      aggregateType: "circle_notification",
      aggregateId: providerEventId,
      correlationId: providerEventId,
      idempotencyKey: `circle-webhook:${providerEventId}`,
      payload: jsonPayload,
      outboxTopic: "circle.notification.received",
    });
    await markWebhookProcessed(event.id);
  }

  return NextResponse.json({ accepted: true, duplicate });
}
