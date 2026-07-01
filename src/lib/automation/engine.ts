import type { SettlementInputEvent } from "@/lib/authorization/types";
import { prisma } from "@/lib/db";
import { findRulesForIngestEvent, markRuleFired } from "./rules";
import { deliverAutomationNotification } from "./notify";

export type AutomationFireResult = {
  ruleId: string;
  notified: boolean;
  channel: string;
  authorizationId?: string;
  authorizationUsd?: number;
};

/** Evaluate enabled rules after authorization ingest — notify operators and link ledger row. */
export async function evaluateAutomationOnIngest(
  events: SettlementInputEvent[],
): Promise<AutomationFireResult[]> {
  const results: AutomationFireResult[] = [];

  for (const event of events) {
    const authorization = await prisma.paymentAuthorization.findUnique({
      where: { idempotencyKey: event.idempotencyKey },
      select: { id: true, amountUsd: true },
    });

    const matches = await findRulesForIngestEvent({
      missionId: event.missionId,
      connectorId: event.connectorId,
      eventType: event.eventType,
    });

    for (const { rule } of matches) {
      const notified = await deliverAutomationNotification({
        rule,
        event,
      });
      await markRuleFired(rule.id, {
        authorizationAmountUsd: authorization?.amountUsd ?? event.amountUsd,
        authorizationId: authorization?.id,
        missionId: event.missionId,
        idempotencyKey: event.idempotencyKey,
        notified,
        autoAuthorized: Boolean(authorization),
      });
      results.push({
        ruleId: rule.id,
        notified,
        channel: rule.notifyChannel,
        authorizationId: authorization?.id,
        authorizationUsd: authorization?.amountUsd ?? event.amountUsd,
      });
    }
  }

  return results;
}
