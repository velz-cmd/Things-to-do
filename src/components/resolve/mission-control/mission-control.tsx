"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMissionScope } from "@/lib/mission/mission-context";
import {
  MissionWorkspace,
  type MissionTurn,
} from "@/components/resolve/mission-control/mission-workspace";
import type { MissionBriefData } from "@/components/resolve/mission-control/mission-brief";
import type { AllocationLine } from "@/components/resolve/mission-control/mission-recommendation";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { MissionPhase } from "@/lib/mission/phases";
import { chipsFromFinding, detectMissionPhase } from "@/lib/mission/phases";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";
import type { IntelligenceBrief } from "@/lib/mission/intelligence-brief";
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
import { captureFromMission } from "@/lib/mission/knowledge";
import {
  createServerMission,
  executeMission,
  fetchMission,
  fetchTimeline,
  fetchWorkbench,
  isMissionServerAvailable,
  migrateLocalSessions,
  sendMissionMessage,
  serverMissionToSession,
  type ServerTimelineEvent,
} from "@/lib/mission/client-api";
import type { AutomationRule } from "@/lib/mission/toolbox/types";

type AdvisorPayload = {
  phase?: MissionPhase;
  capability?: string;
  findings?: MissionFinding[];
  opportunities?: OpportunityCard[];
  policies?: PolicyProposal[];
  actions?: CapabilityAction[];
  answer?: string;
  headline?: string;
  brief?: IntelligenceBrief;
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
  if (reserve > 0) lines.push({ id: "reserve", label: "Reserve", amountUsd: reserve });
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
  return findings.map((f) => ({ ...f, chips: chipsFromFinding(f) }));
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

  return {
    id: `r-${Date.now()}`,
    role: "resolve",
    text: data.answer ?? data.headline ?? "Analysis complete.",
    brief: data.brief,
    findings: findings.length > 0 ? findings : undefined,
    phase,
    capability: data.capability as MissionTurn["capability"],
    allocations:
      isPlan && estCapital ? buildAllocationFromOpportunities(opportunities, estCapital) : undefined,
    policy: isPlan ? pickInlinePolicy(policies, trimmed) : undefined,
    nextSteps: data.actions ?? [],
  };
}

function missionVisitKey(id: string) {
  return `resolve-mission-visit-${id}`;
}

export function MissionControl() {
  const { scope, setScope, enterMission } = useMissionScope();
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<MissionTurn[]>([]);
  const [objective, setObjective] = useState<string | null>(null);
  const [session, setSession] = useState<MissionSession>(() =>
    createMissionSession(getActiveEcosystemId() ?? undefined),
  );
  const [activeWorkspace, setActiveWorkspace] = useState<Ecosystem | null>(null);
  const [loading, setLoading] = useState(false);
  const [thinkingComplete, setThinkingComplete] = useState(false);
  const [activeThinkingSteps, setActiveThinkingSteps] = useState<readonly string[]>(
    thinkingStepsFor("general"),
  );
  const [lastPhase, setLastPhase] = useState<MissionPhase>("discover");
  const [lastCapability, setLastCapability] = useState<string | null>(null);
  const [policies, setPolicies] = useState<PolicyProposal[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [treasuryBalanceUsd, setTreasuryBalanceUsd] = useState<number | undefined>();
  const [timeline, setTimeline] = useState<ServerTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [liveDelta, setLiveDelta] = useState<ServerTimelineEvent[]>([]);
  const [libraryTick, setLibraryTick] = useState(0);
  const [serverMode, setServerMode] = useState(false);
  const [missionStatus, setMissionStatus] = useState<string | null>("created");
  const [lastIntent, setLastIntent] = useState<string | null>(null);

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

      const wb = await fetchWorkbench();
      if (wb) setTreasuryBalanceUsd(wb.treasury.balanceUsd);
    }
    void bootstrap();
  }, []);

  const showCapital = useMemo(
    () =>
      lastPhase === "plan" ||
      lastPhase === "execute" ||
      lastCapability === "allocate_capital" ||
      lastCapability === "execute_settlement" ||
      lastCapability === "claim_value",
    [lastPhase, lastCapability],
  );

  const showPolicies = useMemo(
    () => showCapital && policies.length > 0,
    [showCapital, policies.length],
  );

  const showTimeline = Boolean(objective && (turns.length > 0 || missionStatus));

  const missionBrief: MissionBriefData | null = useMemo(() => {
    if (!objective) return null;
    const lastResolve = [...turns].reverse().find((t) => t.role === "resolve");
    const brief = lastResolve?.brief;
    return {
      objective,
      scope: activeWorkspace?.name ?? "Global",
      status: loading ? "analyzing" : "ready",
      confidence: brief?.priority?.confidence,
      estimatedCapitalUsd: brief?.funding?.deployUsd ?? parseCapitalUsd(objective) ?? undefined,
      affectedCommunities: brief?.findingCount ?? 0,
      evidenceSources: brief?.evidence ?? [],
      capitalAvailableUsd: treasuryBalanceUsd ?? brief?.funding?.availableUsd ?? 0,
      capitalRequiredUsd: brief?.funding?.neededUsd ?? 0,
    };
  }, [objective, turns, loading, activeWorkspace, treasuryBalanceUsd]);

  async function loadTimelineForMission(missionId: string, workspaceId?: string) {
    setTimelineLoading(true);
    try {
      const events = await fetchTimeline({
        ecosystemId: workspaceId,
        missionId,
      });
      setTimeline(events ?? []);

      const lastVisit = localStorage.getItem(missionVisitKey(missionId));
      if (lastVisit && events?.length) {
        const since = new Date(lastVisit).getTime();
        setLiveDelta(events.filter((e) => new Date(e.createdAt).getTime() > since));
      } else {
        setLiveDelta([]);
      }
      localStorage.setItem(missionVisitKey(missionId), new Date().toISOString());
    } finally {
      setTimelineLoading(false);
    }
  }

  const runExecute = useCallback(
    async (missionId: string, execute = false) => {
      setLoading(true);
      try {
        const result = await executeMission({
          missionId,
          dryRun: !execute,
          execute,
          fundPoolUsd: parseCapitalUsd(objective ?? input) ?? undefined,
        });
        if (!result?.ok) throw new Error(result?.error ?? "Execution failed");

        const resolveTurn: MissionTurn = {
          id: `r-${Date.now()}`,
          role: "resolve",
          text: result.dryRun ? "Settlement package prepared." : "Settlement initiated.",
          phase: execute ? "execute" : "plan",
          capability: "execute_settlement",
          brief: {
            headline: result.dryRun ? "Settlement prepared" : "Settlement executing",
            summary: result.dryRun ?
              "Review recipients and amounts before authorizing movement."
            : "Capital movement initiated through treasury and Arc.",
            capability: "execute_settlement",
            capabilityLabel: "Execute settlement",
            findingCount: 0,
            options: [],
            evidence: ["Treasury", "Authorization ledger"],
            recommendations: [],
            actions: [],
            findings: [],
          },
        };
        setTurns((prev) => [...prev, resolveTurn]);
        setMissionStatus(execute ? "completed" : "awaiting_user");
        setLibraryTick((n) => n + 1);
      } catch (e) {
        setTurns((prev) => [
          ...prev,
          {
            id: `r-${Date.now()}`,
            role: "resolve",
            text: e instanceof Error ? e.message : "Execution failed",
            phase: "plan",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [objective, input],
  );

  const sendMessage = useCallback(
    async (text: string, sessionOverride?: MissionSession, policyOverride?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      let activeSession = sessionOverride ?? session;
      const isFirstTurn = turns.length === 0;

      if (serverMode && activeSession.id.startsWith("ms-") && isFirstTurn) {
        const created = await createServerMission({
          title: trimmed.slice(0, 80),
          ecosystemId: activeWorkspace?.id ?? activeSession.ecosystemId,
        });
        if (created) {
          activeSession = serverMissionToSession(created);
          setSession(activeSession);
        }
      }

      if (isFirstTurn) setObjective(trimmed);
      setLastIntent(trimmed);

      const query =
        policyOverride ?
          `${trimmed} [Allocation policy: ${policyOverride}]`
        : trimmed;

      setInput("");
      setLoading(true);
      setThinkingComplete(false);
      enterMission(trimmed);
      setActiveThinkingSteps(thinkingStepsFor(detectMissionIntent(trimmed)));

      const userTurn: MissionTurn = { id: `u-${Date.now()}`, role: "user", text: trimmed };
      const nextTurns = [...turns, userTurn];
      setTurns(nextTurns);

      const history = turns.map((t) => ({
        role: (t.role === "user" ? "user" : "assistant") as "user" | "assistant",
        content: t.text,
      }));

      const workspaceId = activeWorkspace?.id ?? activeSession.ecosystemId;
      const workspacePayload =
        activeWorkspace ?
          { name: activeWorkspace.name, keywords: activeWorkspace.keywords }
        : undefined;

      try {
        let data: AdvisorPayload;

        if (serverMode && !activeSession.id.startsWith("ms-")) {
          const serverData = await sendMissionMessage(activeSession.id, {
            question: query,
            messages: history,
            ecosystemId: workspaceId,
          });
          if (!serverData) throw new Error("Sign in to persist missions");
          data = serverData;
        } else {
          const res = await fetch("/api/workspace/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: query,
              messages: history,
              ecosystem: workspacePayload,
            }),
          });
          const json = (await res.json()) as AdvisorPayload & { error?: string };
          if (!res.ok) throw new Error(json.error ?? "Analysis failed");
          data = json;
        }

        setThinkingComplete(true);
        if (data.stepsRun?.length) setActiveThinkingSteps(data.stepsRun);
        if (data.policies?.length) {
          setPolicies(data.policies);
          if (!selectedPolicyId) {
            const pick = pickInlinePolicy(data.policies, trimmed);
            setSelectedPolicyId(pick?.id ?? data.policies[0]?.id ?? null);
          }
        }

        const resolveTurn = applyAdvisorPayload(trimmed, data);
        const finalTurns = [...nextTurns, resolveTurn];
        setTurns(finalTurns);

        const phase = resolveTurn.phase ?? "discover";
        setLastPhase(phase);
        setLastCapability(data.capability ?? null);

        if (serverMode && data.mission) {
          const updated = serverMissionToSession(data.mission);
          setSession(updated);
          setMissionStatus(data.status ?? updated.status ?? null);
          void loadTimelineForMission(updated.id, workspaceId);
        } else {
          persistLocalSession(activeSession, finalTurns, {
            title: (objective ?? trimmed).slice(0, 48),
            findingCount: resolveTurn.findings?.length,
            phase,
            scope: objective ?? trimmed,
            ecosystemId: workspaceId,
          });
          captureFromMission({
            missionId: activeSession.id,
            missionTitle: objective ?? trimmed,
            ecosystemId: workspaceId,
            findings: resolveTurn.findings?.map((f) => ({ title: f.title, insight: f.insight })),
          });
        }

        setLibraryTick((n) => n + 1);
      } catch (e) {
        setThinkingComplete(true);
        setTurns([
          ...nextTurns,
          {
            id: `r-${Date.now()}`,
            role: "resolve",
            text: e instanceof Error ? e.message : "Could not complete analysis.",
            phase: "discover",
          },
        ]);
        setLibraryTick((n) => n + 1);
      } finally {
        setLoading(false);
      }
    },
    [
      enterMission,
      turns,
      session,
      activeWorkspace,
      serverMode,
      objective,
      selectedPolicyId,
    ],
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
        /review|settlement|package|walk/i.test(`${action.id} ${action.label}`)
      ) {
        void runExecute(session.id, /\b(execute|authorize|settle now)\b/i.test(action.prompt));
        return;
      }
      void sendMessage(action.prompt);
    },
    [runExecute, sendMessage, serverMode, session.id],
  );

  const handlePolicySelect = useCallback(
    (policyId: string) => {
      setSelectedPolicyId(policyId);
      const policy = policies.find((p) => p.id === policyId);
      if (policy && lastIntent) {
        void sendMessage(lastIntent, undefined, policy.label);
      }
    },
    [policies, lastIntent, sendMessage],
  );

  useEffect(() => {
    if (!scope?.label || objective) return;
    void sendMessage(scope.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope?.label]);

  async function handleNewMission() {
    setScope(null);
    const wsId = activeWorkspace?.id ?? getActiveEcosystemId() ?? undefined;

    if (serverMode) {
      const created = await createServerMission({ ecosystemId: wsId });
      setSession(created ? serverMissionToSession(created) : createMissionSession(wsId));
    } else {
      setSession(createMissionSession(wsId));
    }

    setTurns([]);
    setObjective(null);
    setInput("");
    setLastIntent(null);
    setLiveDelta([]);
    setTimeline([]);
    setThinkingComplete(false);
    setLastPhase("discover");
    setLastCapability(null);
    setMissionStatus("created");
  }

  async function handleSelectSession(s: MissionSession) {
    setScope(null);
    setObjective(s.scope ?? s.query ?? s.title);

    if (serverMode && !s.id.startsWith("ms-")) {
      const full = await fetchMission(s.id);
      if (full) {
        const restored = serverMissionToSession(full);
        setSession(restored);
        setMissionStatus(restored.status ?? null);
        const turnList = turnsFromSession(restored);
        setTurns(turnList);
        const lastResolve = [...turnList].reverse().find((t) => t.role === "resolve");
        setLastPhase(lastResolve?.phase ?? restored.phase ?? "discover");
        void loadTimelineForMission(restored.id, restored.ecosystemId ?? undefined);
        return;
      }
    }

    setSession(s);
    setMissionStatus(s.status ?? null);
    if (s.turns?.length) {
      const restored = turnsFromSession(s);
      setTurns(restored);
      const lastResolve = [...restored].reverse().find((t) => t.role === "resolve");
      setLastPhase(lastResolve?.phase ?? s.phase ?? "discover");
    } else if (s.query) {
      setTurns([]);
      void sendMessage(s.query, s);
    }
  }

  function handleSelectWorkspace(ws: Ecosystem | null) {
    setActiveWorkspace(ws);
    setActiveEcosystemId(ws?.id ?? null);
    if (ws) setSession((prev) => ({ ...prev, ecosystemId: ws.id }));
  }

  return (
    <MissionWorkspace
      objective={objective}
      turns={turns}
      loading={loading}
      thinkingComplete={thinkingComplete}
      thinkingSteps={activeThinkingSteps}
      phase={lastPhase}
      input={input}
      onInputChange={setInput}
      onSubmit={(t) => void sendMessage(t)}
      onAction={handleAction}
      onNewMission={() => void handleNewMission()}
      onSelectSession={(s) => void handleSelectSession(s)}
      onSelectWorkspace={handleSelectWorkspace}
      onObservatoryPulse={(q) => void sendMessage(q)}
      onAutomationSelect={(rule: AutomationRule) =>
        void sendMessage(`Automation: when ${rule.trigger}, then ${rule.action}`)
      }
      activeSessionId={session.id}
      activeWorkspace={activeWorkspace}
      missionStatus={missionStatus}
      libraryTick={libraryTick}
      liveDelta={liveDelta}
      policies={policies}
      selectedPolicyId={selectedPolicyId}
      onSelectPolicy={handlePolicySelect}
      showCapital={showCapital}
      showPolicies={showPolicies}
      showTimeline={showTimeline}
      timeline={timeline}
      timelineLoading={timelineLoading}
      treasuryBalanceUsd={treasuryBalanceUsd}
      missionBrief={missionBrief}
    />
  );
}
