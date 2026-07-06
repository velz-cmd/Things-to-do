const STORAGE_KEY = "resolve-mission-agent-budget";
const DEFAULT_CAP_USD = 0.25;

export function getMissionAgentBudgetCap(): number {
  if (typeof window === "undefined") return DEFAULT_CAP_USD;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : DEFAULT_CAP_USD;
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_CAP_USD;
  } catch {
    return DEFAULT_CAP_USD;
  }
}

export function setMissionAgentBudgetCap(usd: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, String(Math.max(0.01, usd)));
}

const QUEUE_KEY = "resolve-mission-queue";
const MAX_QUEUE = 3;

export type MissionQueueItem = {
  id: string;
  objective: string;
  communitySlug?: string;
  addedAt: string;
};

export function loadMissionQueue(): MissionQueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as MissionQueueItem[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_QUEUE) : [];
  } catch {
    return [];
  }
}

export function pushMissionQueue(item: Omit<MissionQueueItem, "id" | "addedAt">): MissionQueueItem[] {
  const next: MissionQueueItem = {
    ...item,
    id: `mq-${Date.now()}`,
    addedAt: new Date().toISOString(),
  };
  const queue = [next, ...loadMissionQueue().filter((q) => q.objective !== item.objective)].slice(
    0,
    MAX_QUEUE,
  );
  if (typeof window !== "undefined") {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
  return queue;
}

export function removeMissionQueueItem(id: string): MissionQueueItem[] {
  const queue = loadMissionQueue().filter((q) => q.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
  return queue;
}
