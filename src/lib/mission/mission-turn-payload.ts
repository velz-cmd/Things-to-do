import { resolveChatResponseSchema, type ResolveChatResponse } from "@/lib/mission/structured-contract";

/** Serializable turn extras for Mission session restore (Blueprint, agent lane). */
export type MissionTurnPayload = {
  blueprint?: { prompt: string; initialBudgetUsd?: number };
  agentSignal?: { prompt: string; serviceId?: string };
  communalPool?: { prompt: string; communitySlug?: string };
  batchAllocation?: { prompt: string; communitySlug?: string; initialBudgetUsd?: number };
  structuredResponse?: ResolveChatResponse;
};

export function parseTurnPayload(raw: string | null | undefined): MissionTurnPayload | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as MissionTurnPayload;
    if (!parsed || typeof parsed !== "object") return undefined;
    if (parsed.structuredResponse) {
      const response = resolveChatResponseSchema.safeParse(parsed.structuredResponse);
      if (!response.success) delete parsed.structuredResponse;
      else parsed.structuredResponse = response.data;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export function stringifyTurnPayload(payload: MissionTurnPayload | undefined): string | null {
  if (
    !payload?.blueprint &&
    !payload?.agentSignal &&
    !payload?.communalPool &&
    !payload?.batchAllocation &&
    !payload?.structuredResponse
  ) {
    return null;
  }
  return JSON.stringify(payload);
}
