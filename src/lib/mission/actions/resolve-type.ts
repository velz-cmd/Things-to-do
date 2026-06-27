import type { CapabilityAction } from "@/lib/mission/capabilities/types";
import type { MissionActionType } from "./types";

/** Map UI action pills to executable action types. */
export function resolveMissionActionType(action: CapabilityAction): MissionActionType {
  if (action.actionType) return action.actionType;

  if (action.kind === "navigate" && action.href) return "navigate";
  if (action.kind === "remember" || action.id === "save" || /save.*knowledge/i.test(action.label)) {
    return "save_knowledge";
  }

  if (action.id === "claim" || action.href === "/claim") return "open_claim";
  if (action.id === "treasury" || action.href === "/payments" || action.href === "/treasury") {
    return "fund_treasury";
  }

  if (action.kind === "execute") {
    if (
      action.id === "github-alloc" ||
      /github alloc/i.test(action.label)
    ) {
      return "github_allocate";
    }
    if (
      /\b(authorize|settle now|execute now|send funds)\b/i.test(`${action.label} ${action.prompt}`)
    ) {
      return "execute_settlement";
    }
    if (
      /review|package|walk|prepare|settlement|dist-plan|settle/i.test(`${action.id} ${action.label}`)
    ) {
      return "prepare_settlement";
    }
    return "prepare_settlement";
  }

  return "chat";
}
