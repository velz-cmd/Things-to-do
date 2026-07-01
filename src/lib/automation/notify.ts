import type { SettlementInputEvent } from "@/lib/authorization/types";
import type { AutomationRuleRecord } from "./types";
import { getTriggerDef } from "./types";

export async function deliverAutomationNotification(input: {
  rule: AutomationRuleRecord;
  event: SettlementInputEvent;
}): Promise<boolean> {
  const { rule, event } = input;
  const trigger = getTriggerDef(rule.triggerEvent);
  const headline = `${trigger.label} authorized $${event.amountUsd.toFixed(4)}`;
  const detail = `${event.contextLabel ?? event.payeeKey} · mission ${event.missionId.slice(0, 10)}…`;

  if (rule.notifyChannel === "webhook" && rule.notifyTarget.startsWith("http")) {
    try {
      const res = await fetch(rule.notifyTarget, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "resolve.automation",
          ruleId: rule.id,
          communitySlug: rule.communitySlug,
          trigger: rule.triggerEvent,
          headline,
          detail,
          amountUsd: event.amountUsd,
          missionId: event.missionId,
          eventType: event.eventType,
          connectorId: event.connectorId,
        }),
        signal: AbortSignal.timeout(8_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  if (rule.notifyChannel === "email" && rule.notifyTarget.includes("@")) {
    try {
      const { Resend } = await import("resend");
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        console.info("[automation] email skipped — RESEND_API_KEY not set", {
          to: rule.notifyTarget,
          headline,
        });
        return false;
      }
      const resend = new Resend(apiKey);
      const from = process.env.RESEND_FROM_EMAIL ?? "RESOLVE <notify@resolve.app>";
      const { error } = await resend.emails.send({
        from,
        to: rule.notifyTarget,
        subject: `[RESOLVE] ${headline}`,
        text: `${headline}\n\n${detail}\n\nCommunity: ${rule.communitySlug}\nRule: ${rule.name}\n`,
      });
      return !error;
    } catch (e) {
      console.warn("[automation] email failed", e);
      return false;
    }
  }

  console.info("[automation] notification logged (no channel configured)", {
    ruleId: rule.id,
    channel: rule.notifyChannel,
    target: rule.notifyTarget,
    headline,
  });
  return false;
}
