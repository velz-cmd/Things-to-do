import type { MissionPhase } from "@/lib/mission/phases";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { MissionStatus } from "@/lib/mission/state-machine";

export type ServerMission = {
  id: string;
  title: string;
  scope: string | null;
  status: MissionStatus;
  capability: string | null;
  phase: string | null;
  ecosystemId: string | null;
  findingCount: number;
  capitalUsd: number | null;
  createdAt: string;
  updatedAt: string;
    turns: Array<{
    id: string;
    role: "user" | "resolve";
    text: string;
    phase?: MissionPhase;
    capability?: string;
    findings?: MissionFinding[];
    actions?: import("@/lib/mission/capabilities/types").CapabilityAction[];
    report?: import("@/lib/mission/mission-report").MissionReport;
  }>;
};

export type ServerEcosystem = {
  id: string;
  name: string;
  kind: string;
  keywords: string[];
  repos: Array<{
    owner: string;
    repo: string;
    fullName: string;
    stars?: number;
    fundingGapUsd?: number;
    maintainerCount?: number;
  }>;
  connectors: string[];
  missionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ServerKnowledge = {
  id: string;
  title: string;
  kind: string;
  summary: string;
  source: string | null;
  ecosystemId: string | null;
  missionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServerTimelineEvent = {
  id: string;
  ecosystemId: string | null;
  missionId: string | null;
  eventType: string;
  title: string;
  detail: string | null;
  severity: string;
  createdAt: string;
};

export type ServerWorkbench = {
  treasury: {
    balanceUsd: number;
    obligationsUsd: number;
    canSettleGlobally: boolean;
    blockers: string[];
  };
  ledger: {
    count: number;
    claimableUsd: number;
    pendingFundingUsd: number;
    settledUsd: number;
  } | null;
  connectors: Array<{
    id: string;
    health: string;
    eventsToday: number;
    authorizationCount: number;
    connectHref: string;
  }>;
  apis: Array<{ id: string; label: string; href: string; live: boolean }>;
};

async function missionFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 401) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export async function isMissionServerAvailable(): Promise<boolean> {
  const res = await fetch("/api/mission/sessions", { method: "GET" });
  return res.status !== 401;
}

export async function fetchMissions(): Promise<ServerMission[] | null> {
  const data = await missionFetch<{ missions: ServerMission[] }>("/api/mission/sessions");
  return data?.missions ?? null;
}

export async function createServerMission(input?: {
  title?: string;
  ecosystemId?: string;
}): Promise<ServerMission | null> {
  const data = await missionFetch<{ mission: ServerMission }>("/api/mission/sessions", {
    method: "POST",
    body: JSON.stringify(input ?? {}),
  });
  return data?.mission ?? null;
}

export async function fetchMission(id: string): Promise<ServerMission | null> {
  const data = await missionFetch<{ mission: ServerMission }>(`/api/mission/sessions/${id}`);
  return data?.mission ?? null;
}

export async function deleteServerMission(id: string): Promise<boolean> {
  const data = await missionFetch<{ ok: boolean }>(`/api/mission/sessions/${id}`, {
    method: "DELETE",
  });
  return Boolean(data?.ok);
}

export async function sendMissionMessage(
  missionId: string,
  input: {
    question: string;
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
    ecosystemId?: string;
  },
) {
  return missionFetch<{
    ok: boolean;
    answer: string;
    headline: string;
    brief: import("@/lib/mission/intelligence-brief").IntelligenceBrief;
    report: import("@/lib/mission/mission-report").MissionReport;
    findings: MissionFinding[];
    phase: MissionPhase;
    capability: string;
    actions: import("@/lib/mission/capabilities/types").CapabilityAction[];
    opportunities: import("@/lib/workspace/advisors/opportunity-cards").OpportunityCard[];
    policies: import("@/lib/workspace/advisors/policy-proposals").PolicyProposal[];
    stepsRun: string[];
    mission: ServerMission;
    status: string;
    error?: string;
  }>(`/api/mission/sessions/${missionId}/message`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchEcosystems(): Promise<ServerEcosystem[] | null> {
  const data = await missionFetch<{ ecosystems: ServerEcosystem[] }>("/api/mission/ecosystems");
  return data?.ecosystems ?? null;
}

export async function createServerEcosystem(name: string, kind?: string) {
  const data = await missionFetch<{ ecosystem: ServerEcosystem }>("/api/mission/ecosystems", {
    method: "POST",
    body: JSON.stringify({ name, kind }),
  });
  return data?.ecosystem ?? null;
}

export async function refreshEcosystem(id: string) {
  const data = await missionFetch<{ ecosystem: ServerEcosystem }>(
    `/api/mission/ecosystems/${id}/refresh`,
    { method: "PATCH" },
  );
  return data?.ecosystem ?? null;
}

export async function fetchKnowledge(): Promise<ServerKnowledge[] | null> {
  const data = await missionFetch<{ knowledge: ServerKnowledge[] }>("/api/mission/knowledge");
  return data?.knowledge ?? null;
}

export async function fetchTimeline(opts?: { ecosystemId?: string; missionId?: string }) {
  const params = new URLSearchParams();
  if (opts?.ecosystemId) params.set("ecosystemId", opts.ecosystemId);
  if (opts?.missionId) params.set("missionId", opts.missionId);
  const qs = params.toString();
  const data = await missionFetch<{ timeline: ServerTimelineEvent[] }>(
    `/api/mission/timeline${qs ? `?${qs}` : ""}`,
  );
  return data?.timeline ?? null;
}

export async function fetchWorkbench(): Promise<ServerWorkbench | null> {
  const data = await missionFetch<{ workbench: ServerWorkbench }>("/api/mission/workbench");
  return data?.workbench ?? null;
}

export async function executeMission(input: {
  missionId: string;
  owner?: string;
  repo?: string;
  fundPoolUsd?: number;
  dryRun?: boolean;
  execute?: boolean;
}) {
  return missionFetch<{
    ok: boolean;
    dryRun?: boolean;
    plan?: Record<string, unknown>;
    error?: string;
  }>("/api/mission/execute", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchToolbox() {
  const data = await missionFetch<
    import("@/lib/mission/toolbox/types").ToolboxSnapshot & { ok: boolean }
  >("/api/mission/toolbox");
  if (!data) return null;
  const { ok: _ok, ...snapshot } = data;
  return snapshot;
}

export async function migrateLocalSessions(
  sessions: Array<{
    title: string;
    query: string;
    ecosystemId?: string;
    turns?: Array<{ role: string; text: string }>;
  }>,
) {
  return missionFetch<{ migrated: number }>("/api/mission/migrate", {
    method: "POST",
    body: JSON.stringify({ sessions }),
  });
}

export function serverMissionToSession(m: ServerMission) {
  return {
    id: m.id,
    title: m.title,
    kind: "mission" as const,
    query: m.scope ?? m.title,
    scope: m.scope ?? undefined,
    ecosystemId: m.ecosystemId ?? undefined,
    phase: (m.phase as MissionPhase | undefined) ?? undefined,
    status: m.status,
    savedAt: m.createdAt,
    updatedAt: m.updatedAt,
    findingCount: m.findingCount,
    turns: m.turns.map((t) => ({
      id: t.id,
      role: t.role,
      text: t.text,
      phase: t.phase,
      findings: t.findings,
      capability: t.capability,
      actions: t.actions,
      report: t.report,
    })),
  };
}

export function serverEcosystemToClient(e: ServerEcosystem) {
  return {
    id: e.id,
    name: e.name,
    kind: e.kind as import("@/lib/mission/ecosystems").EcosystemKind,
    keywords: e.keywords,
    repos: e.repos,
    connectors: e.connectors,
    missionCount: e.missionCount,
    createdAt: e.createdAt,
  };
}

export function serverKnowledgeToClient(k: ServerKnowledge) {
  return {
    id: k.id,
    title: k.title,
    kind: k.kind as import("@/lib/mission/knowledge").KnowledgeKind,
    summary: k.summary,
    ecosystemId: k.ecosystemId ?? undefined,
    missionId: k.missionId ?? undefined,
    savedAt: k.updatedAt,
  };
}
