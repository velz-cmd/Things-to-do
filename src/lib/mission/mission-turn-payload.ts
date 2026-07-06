/** Serializable turn extras for Mission session restore (Blueprint, agent lane). */
export type MissionTurnPayload = {
  blueprint?: { prompt: string; initialBudgetUsd?: number };
  agentSignal?: { prompt: string; serviceId?: string };
  fulfillPool?: { prompt: string; communitySlug?: string };
  personalPool?: { prompt: string; initialBudgetUsd?: number };
  communalPool?: { prompt: string; communitySlug?: string };
  batchAllocation?: { prompt: string; communitySlug?: string; initialBudgetUsd?: number };
};

export function parseTurnPayload(raw: string | null | undefined): MissionTurnPayload | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as MissionTurnPayload;
    if (!parsed || typeof parsed !== "object") return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function stringifyTurnPayload(payload: MissionTurnPayload | undefined): string | null {
  if (
    !payload?.blueprint &&
    !payload?.agentSignal &&
    !payload?.fulfillPool &&
    !payload?.personalPool &&
    !payload?.communalPool &&
    !payload?.batchAllocation
  ) {
    return null;
  }
  return JSON.stringify(payload);
}
