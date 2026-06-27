export type KnowledgeKind =
  | "research"
  | "governance"
  | "decision"
  | "philosophy"
  | "discussion"
  | "mission";

export type KnowledgeEntry = {
  id: string;
  title: string;
  kind: KnowledgeKind;
  summary: string;
  ecosystemId?: string;
  missionId?: string;
  savedAt: string;
};

const STORAGE_KEY = "resolve-knowledge";
const MAX_ENTRIES = 64;

export function loadKnowledge(): KnowledgeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as KnowledgeEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertKnowledge(entry: KnowledgeEntry) {
  if (typeof window === "undefined") return;
  const existing = loadKnowledge();
  const idx = existing.findIndex((e) => e.id === entry.id);
  if (idx >= 0) existing[idx] = entry;
  else existing.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_ENTRIES)));
}

/** Capture durable learnings from a completed mission turn. */
export function captureFromMission(input: {
  missionId: string;
  missionTitle: string;
  ecosystemId?: string;
  findings?: Array<{ title: string; insight: string }>;
}) {
  if (!input.findings?.length) return;
  const top = input.findings[0];
  if (!top) return;

  upsertKnowledge({
    id: `k-${input.missionId}-${top.title.slice(0, 24).replace(/\s+/g, "-").toLowerCase()}`,
    title: input.missionTitle || top.title,
    kind: "mission",
    summary: top.insight,
    ecosystemId: input.ecosystemId,
    missionId: input.missionId,
    savedAt: new Date().toISOString(),
  });
}

export function searchKnowledge(query: string): KnowledgeEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return loadKnowledge();
  return loadKnowledge().filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q),
  );
}
