import type { SettlementInputEvent } from "@/lib/authorization/types";
import { findRulesForIngestEvent, markRuleFired } from "./rules";
import { deliverAutomationNotification } from "./notify";

export type AutomationFireResult = {
  ruleId: string;
  notified: boolean;
  channel: string;
};

/** Evaluate enabled rules after authorization ingest — notify operators. */
export async function evaluateAutomationOnIngest(
  events: SettlementInputEvent[],
): Promise<AutomationFireResult[]> {
  const results: AutomationFireResult[] = [];

  for (const event of events) {
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
        authorizationAmountUsd: event.amountUsd,
        missionId: event.missionId,
        idempotencyKey: event.idempotencyKey,
        notified,
      });
      results.push({
        ruleId: rule.id,
        notified,
        channel: rule.notifyChannel,
      });
    }
  }

  return results;
}
