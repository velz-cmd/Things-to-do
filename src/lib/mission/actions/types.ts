import type { CapabilityAction, MissionActionType } from "@/lib/mission/capabilities/types";

export type { MissionActionType };

export type MissionActionPayload = CapabilityAction;

export type MissionActionResult = {
  ok: boolean;
  actionType: MissionActionType;
  message: string;
  receipt?: Record<string, unknown>;
  navigateTo?: string;
  error?: string;
};
