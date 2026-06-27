"use client";

import { useCallback, useEffect, useState } from "react";
import { useMissionScope } from "@/lib/mission/mission-context";
import { MissionWorkspace, type MissionTurn } from "@/components/resolve/mission-control/mission-workspace";
import type { AllocationLine } from "@/components/resolve/mission-control/mission-recommendation";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { MissionPhase } from "@/lib/mission/phases";
import { chipsFromFinding, detectMissionPhase } from "@/lib/mission/phases";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";
import { parseCapitalUsd, thinkingStepsFor, detectMissionIntent } from "@/lib/mission/intents";
import {
  createMissionSession,
  loadMissionSessions,
  upsertMissionSession,
  type MissionSession,
} from "@/lib/mission/toolbox/mission-library";
import {
  getActiveEcosystemId,
  setActiveEcosystemId,
  type Ecosystem,
} from "@/lib/mission/ecosystems";
import { captureFromMission, type KnowledgeEntry } from "@/lib/mission/knowledge";
import {
  createServerMission,
  executeMission,
  fetchMission,
  isMissionServerAvailable,
  migrateLocalSessions,
  sendMissionMessage,
  serverMissionToSession,
} from "@/lib/mission/client-api";

type AdvisorPayload = {
  phase?: MissionPhase;
  capability?: string;
  findings?: MissionFinding[];
  opportunities?: OpportunityCard[];
  policies?: PolicyProposal[];
  actions?: CapabilityAction[];
  answer?: string;
  headline?: string;
  stepsRun?: string[];
  status?: string;
  mission?: import("@/lib/mission/client-api").ServerMission;
};

function buildAllocationFromOpportunities(
  opportunities: OpportunityCard[],
  totalUsd: number,
): AllocationLine[] {
  if (!opportunities.length || totalUsd <= 0) return [];

  const weighted = opportunities.map((o) => {
    const gap = Number(o.statB.value.replace(/[$,]/g, "")) || 1;
    const label = o.title.includes(" — ") ? o.title.split(" — ")[0]! : o.title;
    return { id: o.id, label, gap };
  });

  const gapTotal = weighted.reduce((s, w) => s + w.gap, 0);
  const spendable = Math.round(totalUsd * 0.85);
  const lines = weighted.map((w) => ({
    id: w.id,
    label: w.label,
    amountUsd: Math.round((w.gap / gapTotal) * spendable),
  }));

  const allocated = lines.reduce((s, l) => s + l.amountUsd, 0);
  const reserve = totalUsd - allocated;
  if (reserve > 0) {
    lines.push({ id: "reserve", label: "Reserve", amountUsd: reserve });
  }

  return lines;
}

function pickInlinePolicy(policies: PolicyProposal[], text: string): PolicyProposal | undefined {
  if (!policies.length) return undefined;
  if (/\b(conserv|stable|safe|infrastructure|protect)\b/i.test(text)) {
    return policies.find((p) => p.id === "infrastructure") ?? policies[0];
  }
  if (/\b(aggress|growth|meme|accelerat)\b/i.test(text)) {
    return policies.find((p) => p.id === "growth") ?? policies[0];
  }
  return policies.find((p) => p.id === "balanced") ?? policies[0];
}

function enrichFindings(findings: MissionFinding[]): MissionFinding[] {
  return findings.map((f) => ({
    ...f,
    chips: chipsFromFinding(f),
  }));
}

function persistLocalSession(
  session: MissionSession,
  turns: MissionTurn[],
  opts: {
    title?: string;
    findingCount?: number;
    phase?: MissionPhase;
    scope?: string;
    ecosystemId?: string;
    status?: string;
  },
) {
  const firstUser = turns.find((t) => t.role === "user");
  const lastResolve = [...turns].reverse().find((t) => t.role === "resolve");
  upsertMissionSession({
    ...session,
    title: opts.title ?? session.title,
    query: firstUser?.text ?? session.query,
    scope: opts.scope ?? session.scope ?? firstUser?.text,
    ecosystemId: opts.ecosystemId ?? session.ecosystemId,
    phase: opts.phase ?? lastResolve?.phase ?? session.phase,
    status: opts.status ?? session.status,
    findingCount: opts.findingCount,
    lastFindings: lastResolve?.findings,
    turns: turns.map((t) => ({
      id: t.id,
      role: t.role,
      text: t.text,
      phase: t.phase,
      findings: t.findings,
      capability: t.capability,
      actions: t.nextSteps,
    })),
  });
}

function turnsFromSession(session: MissionSession): MissionTurn[] {
  if (!session.turns?.length) return [];
  return session.turns.map((t) => ({
    id: t.id,
    role: t.role,
    text: t.text,
    phase: t.phase,
    findings: t.findings,
    capability: t.capability as MissionTurn["capability"],
    nextSteps: t.actions,
  }));
}

function applyAdvisorPayload(trimmed: string, data: AdvisorPayload): MissionTurn {
  const phase: MissionPhase = data.phase ?? detectMissionPhase(trimmed, []);
  const findings = enrichFindings(data.findings ?? []);
  const estCapital = parseCapitalUsd(trimmed);
  const opportunities: OpportunityCard[] = data.opportunities ?? [];
  const policies: PolicyProposal[] = data.policies ?? [];
  const isPlan =
    phase === "plan" || data.capability === "allocate_capital" || Boolean(estCapital);
  const answer = data.answer ?? data.headline ?? "No analysis available.";

  return {
    id: `r-${Date.now()}`,
    role: "resolve",
    text: answer,
    findings: findings.length > 0 ? findings : undefined,
    phase,
    capability: data.capability as MissionTurn["capability"],
    allocations:
      isPlan && estCapital ? buildAllocationFromOpportunities(opportunities, estCapital) : undefined,
    policy: isPlan ? pickInlinePolicy(policies, trimmed) : undefined,
    nextSteps: data.actions ?? [],
  };
}

export function MissionControl() {
  const { scope, setScope, enterMission } = useMissionScope();
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<MissionTurn[]>([]);
  const [session, setSession] = useState<MissionSession>(() =>
    createMissionSession(getActiveEcosystemId() ?? undefined),
  );
  const [activeEcosystem, setActiveEcosystem] = useState<Ecosystem | null>(null);
  const [loading, setLoading] = useState(false);
  const [thinkingComplete, setThinkingComplete] = useState(false);
  const [activeThinkingSteps, setActiveThinkingSteps] = useState<readonly string[]>(
    thinkingStepsFor("general"),
  );
  const [lastPhase, setLastPhase] = useState<MissionPhase>("discover");
  const [libraryTick, setLibraryTick] = useState(0);
  const [serverMode, setServerMode] = useState(false);
  const [missionStatus, setMissionStatus] = useState<string | null>(null);
  const started = turns.length > 0;

  useEffect(() => {
    async function bootstrap() {
      const available = await isMissionServerAvailable();
      setServerMode(available);
      if (!available) return;

      const local = loadMissionSessions();
      if (local.length > 0) {
        await migrateLocalSessions(
          local.map((s) => ({
            title: s.title,
            query: s.query || s.scope || s.title,
            ecosystemId: s.ecosystemId,
            turns: s.turns?.map((t) => ({ role: t.role, text: t.text })),
          })),
        ).catch(() => undefined);
      }
    }
    void bootstrap();
  }, []);

  const runExecute = useCallback(
    async (missionId: string, execute = false) => {
      setLoading(true);
      try {
        const result = await executeMission({
          missionId,
          dryRun: !execute,
          execute,
          fundPoolUsd: parseCapitalUsd(input) ?? undefined,
        });
        if (!result?.ok) {
          throw new Error(result?.error ?? "Execution failed");
        }
        const msg =
          result.dryRun ?
            `Allocation prepared for settlement review. ${JSON.stringify(result.plan?.preview ?? result.plan ?? "")}`
          : "Settlement initiated through treasury and Arc.";
        const resolveTurn: MissionTurn = {
          id: `r-${Date.now()}`,
          role: "resolve",
          text: msg,
          phase: execute ? "execute" : "plan",
          capability: "execute_settlement",
        };
        setTurns((prev) => [...prev, resolveTurn]);
        setMissionStatus(execute ? "completed" : "awaiting_user");
        setLibraryTick((n) => n + 1);
      } catch (e) {
        const resolveTurn: MissionTurn = {
          id: `r-${Date.now()}`,
          role: "resolve",
          text: e instanceof Error ? e.message : "Execution failed",
          phase: "plan",
        };
        setTurns((prev) => [...prev, resolveTurn]);
      } finally {
        setLoading(false);
      }
    },
    [input],
  );

  const sendMessage = useCallback(
    async (text: string, sessionOverride?: MissionSession) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      let activeSession = sessionOverride ?? session;

      if (serverMode && !activeSession.id.startsWith("ms-")) {
        // already server id
      } else if (serverMode && activeSession.id.startsWith("ms-") && turns.length === 0) {
        const created = await createServerMission({
          title: trimmed.slice(0, 80),
          ecosystemId: activeEcosystem?.id ?? activeSession.ecosystemId,
        });
        if (created) {
          activeSession = serverMissionToSession(created);
          setSession(activeSession);
        }
      }

      setInput("");
      setLoading(true);
      setThinkingComplete(false);
      enterMission(trimmed);
      setActiveThinkingSteps(thinkingStepsFor(detectMissionIntent(trimmed)));

      const userTurn: MissionTurn = {
        id: `u-${Date.now()}`,
        role: "user",
        text: trimmed,
      };
      const nextTurns = [...turns, userTurn];
      setTurns(nextTurns);

      const history = turns.map((t) => ({
        role: (t.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: t.text,
      }));

      const ecosystemId = activeEcosystem?.id ?? activeSession.ecosystemId;
      const ecosystemPayload =
        activeEcosystem ?
          { name: activeEcosystem.name, keywords: activeEcosystem.keywords }
        : undefined;

      try {
        let data: AdvisorPayload;

        if (serverMode && !activeSession.id.startsWith("ms-")) {
          const serverData = await sendMissionMessage(activeSession.id, {
            question: trimmed,
            messages: history,
            ecosystemId,
          });
          if (!serverData) throw new Error("Sign in to persist missions");
          data = serverData;
        } else {
          const res = await fetch("/api/workspace/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: trimmed,
              messages: history,
              ecosystem: ecosystemPayload,
            }),
          });
          const json = (await res.json()) as AdvisorPayload & { error?: string };
          if (!res.ok) throw new Error(json.error ?? "Analysis failed");
          data = json;
        }

        setThinkingComplete(true);

        if (data.stepsRun?.length) {
          setActiveThinkingSteps(data.stepsRun);
        }

        const resolveTurn = applyAdvisorPayload(trimmed, data);
        const finalTurns = [...nextTurns, resolveTurn];
        setTurns(finalTurns);

        const phase = resolveTurn.phase ?? "discover";
        setLastPhase(phase);

        const title = trimmed.slice(0, 48) + (trimmed.length > 48 ? "…" : "");

        if (serverMode && data.mission) {
          const updated = serverMissionToSession(data.mission);
          setSession(updated);
          setMissionStatus(data.status ?? updated.status ?? null);
        } else {
          persistLocalSession(activeSession, finalTurns, {
            title,
            findingCount: resolveTurn.findings?.length,
            phase,
            scope: nextTurns.find((t) => t.role === "user")?.text,
            ecosystemId,
          });
          captureFromMission({
            missionId: activeSession.id,
            missionTitle: title,
            ecosystemId,
            findings: resolveTurn.findings?.map((f) => ({ title: f.title, insight: f.insight })),
          });
        }

        setLibraryTick((n) => n + 1);
      } catch (e) {
        setThinkingComplete(true);
        const errTurn: MissionTurn = {
          id: `r-${Date.now()}`,
          role: "resolve",
          text: e instanceof Error ? e.message : "Could not complete analysis.",
          phase: "discover",
        };
        const finalTurns = [...nextTurns, errTurn];
        setTurns(finalTurns);
        if (!serverMode) {
          persistLocalSession(activeSession, finalTurns, { ecosystemId });
        }
        setLibraryTick((n) => n + 1);
      } finally {
        setLoading(false);
      }
    },
    [enterMission, turns, session, activeEcosystem, serverMode],
  );

  const handleAction = useCallback(
    (action: CapabilityAction) => {
      if (action.href && action.kind === "navigate") {
        window.location.href = action.href;
        return;
      }
      if (
        action.kind === "execute" &&
        serverMode &&
        !session.id.startsWith("ms-") &&
        (action.id === "execute" || /settlement|allocat/i.test(action.prompt))
      ) {
        const approve = /\b(execute|authorize|settle now|move money)\b/i.test(action.prompt);
        void runExecute(session.id, approve);
        return;
      }
      void sendMessage(action.prompt);
    },
    [runExecute, sendMessage, serverMode, session.id],
  );

  useEffect(() => {
    if (!scope?.label || started) return;
    void sendMessage(scope.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap from URL scope once
  }, [scope?.label]);

  async function handleNewMission() {
    setScope(null);
    const ecoId = activeEcosystem?.id ?? getActiveEcosystemId() ?? undefined;

    if (serverMode) {
      const created = await createServerMission({ ecosystemId: ecoId });
      if (created) {
        setSession(serverMissionToSession(created));
      } else {
        setSession(createMissionSession(ecoId));
      }
    } else {
      setSession(createMissionSession(ecoId));
    }

    setTurns([]);
    setInput("");
    setThinkingComplete(false);
    setLastPhase("discover");
    setMissionStatus("created");
  }

  async function handleSelectSession(s: MissionSession) {
    setScope(null);

    if (serverMode && !s.id.startsWith("ms-")) {
      const full = await fetchMission(s.id);
      if (full) {
        const restored = serverMissionToSession(full);
        setSession(restored);
        setMissionStatus(restored.status ?? null);
        if (restored.turns?.length) {
          const turnList = turnsFromSession(restored);
          setTurns(turnList);
          const lastResolve = [...turnList].reverse().find((t) => t.role === "resolve");
          setLastPhase(lastResolve?.phase ?? restored.phase ?? "discover");
          return;
        }
      }
    }

    setSession(s);
    setMissionStatus(s.status ?? null);
    if (s.turns && s.turns.length > 0) {
      const restored = turnsFromSession(s);
      setTurns(restored);
      const lastResolve = [...restored].reverse().find((t) => t.role === "resolve");
      setLastPhase(lastResolve?.phase ?? s.phase ?? "discover");
    } else if (s.query) {
      setTurns([]);
      void sendMessage(s.query, s);
    }
  }

  function handleSelectEcosystem(eco: Ecosystem | null) {
    setActiveEcosystem(eco);
    setActiveEcosystemId(eco?.id ?? null);
    if (eco) {
      setSession((prev) => ({ ...prev, ecosystemId: eco.id }));
    }
  }

  function handleSelectKnowledge(entry: KnowledgeEntry) {
    if (entry.missionId) {
      const s = loadMissionSessions().find((m) => m.id === entry.missionId);
      if (s) {
        void handleSelectSession(s);
        return;
      }
      void handleSelectSession({
        id: entry.missionId,
        title: entry.title,
        kind: "mission",
        query: entry.summary,
        savedAt: entry.savedAt,
        updatedAt: entry.savedAt,
      });
      return;
    }
    void sendMessage(`Continue from: ${entry.title} — ${entry.summary}`);
  }

  function handleClear() {
    void handleNewMission();
  }

  return (
    <MissionWorkspace
      started={started}
      turns={turns}
      loading={loading}
      thinkingComplete={thinkingComplete}
      thinkingSteps={activeThinkingSteps}
      phase={lastPhase}
      input={input}
      onInputChange={setInput}
      onSubmit={(t) => void sendMessage(t)}
      onChip={(t) => void sendMessage(t)}
      onAction={handleAction}
      onNewMission={() => void handleNewMission()}
      onSelectSession={(s) => void handleSelectSession(s)}
      onSelectEcosystem={handleSelectEcosystem}
      onSelectKnowledge={handleSelectKnowledge}
      activeSessionId={session.id}
      activeEcosystem={activeEcosystem}
      missionStatus={missionStatus}
      onClear={handleClear}
      libraryTick={libraryTick}
    />
  );
}
