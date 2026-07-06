"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMissionScope } from "@/lib/mission/mission-context";
import {
  MissionWorkspace,
  type MissionTurn,
} from "@/components/resolve/mission-control/mission-workspace";
import type { AllocationLine } from "@/components/resolve/mission-control/mission-recommendation";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { MissionPhase } from "@/lib/mission/phases";
import { chipsFromFinding, detectMissionPhase } from "@/lib/mission/phases";
import type { CapabilityAction } from "@/lib/mission/capabilities/types";
import type { IntelligenceBrief } from "@/lib/mission/intelligence-brief";
import type { MissionReport } from "@/lib/mission/mission-report";
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
  dispatchMissionAction,
  executeMission,
  fetchMission,
  fetchTimeline,
  fetchWorkbench,
  isMissionServerAvailable,
  migrateLocalSessions,
  sendMissionMessage,
  serverMissionToSession,
  syncMissionSession,
  type ServerTimelineEvent,
} from "@/lib/mission/client-api";
import { missionTurnsToSyncInput, sessionTitleFromTurns } from "@/lib/mission/mission-session-sync";
import type { AutomationRule } from "@/lib/mission/toolbox/types";
import type { OperatingMode, CapitalLoopPhase } from "@/lib/mission/capital-os";
import { detectOperatingMode, detectCapitalLoopPhase, detectMissionJob } from "@/lib/mission/capital-os";
import { resolveMissionTopic } from "@/lib/mission/mission-topic";
import { resolveMissionActionType } from "@/lib/mission/actions/resolve-type";
import { detectAgentSignalIntent } from "@/lib/mission/detect-agent-signal-intent";
import { detectBlueprintIntent } from "@/lib/mission/detect-blueprint-intent";
import { matchServiceForPrompt } from "@/lib/agent/commerce-match";
import { formatAgentPrice } from "@/lib/agent/agent-signal-format";
import { resolveMissionCommunitySlug } from "@/lib/mission/mission-community-slug";
import { prefetchMissionPool } from "@/lib/mission/prefetch-mission-pool";
import { MissionBlueprintCommandProvider } from "@/components/resolve/mission-control/mission-blueprint-command-context";

type AdvisorPayload = {
  phase?: MissionPhase;
  capability?: string;
  findings?: MissionFinding[];
  opportunities?: OpportunityCard[];
  policies?: PolicyProposal[];
  actions?: CapabilityAction[];
  researchReferences?: import("@/lib/mission/capabilities/types").ResearchReference[];
  answer?: string;
  headline?: string;
  brief?: IntelligenceBrief;
  report?: MissionReport;
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
      report: t.report,
      blueprint: t.blueprint,
      agentSignal: t.agentSignal,
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
    report: t.report,
    blueprint: t.blueprint,
    agentSignal: t.agentSignal,
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
    text: data.report?.summary ?? data.answer ?? data.headline ?? "Mission complete.",
    brief: data.brief,
    report: data.report,
    findings: findings.length > 0 ? findings : undefined,
    phase,
    capability: data.capability as MissionTurn["capability"],
    allocations:
      isPlan && estCapital ? buildAllocationFromOpportunities(opportunities, estCapital) : undefined,
    policy: isPlan ? pickInlinePolicy(policies, trimmed) : undefined,
    nextSteps: data.actions ?? data.report?.actions ?? [],
    researchReferences: data.researchReferences ?? data.report?.researchReferences,
  };
}

function missionVisitKey(id: string) {
  return `resolve-mission-visit-${id}`;
}

const AGENT_SIGNAL_THINKING = [
  "Matching signal catalog",
  "Pricing micropay",
  "Checking wallet path",
  "Preparing agent run",
] as const;

function agentSignalIntro(serviceName: string, priceUsd: number, billingUnit: string): string {
  return `I'll run ${serviceName} for your prompt — ${formatAgentPrice(priceUsd)} per ${billingUnit}. Review what you get below, then authorize the run.`;
}

export function MissionControl() {
  const searchParams = useSearchParams();
  const urlPromptHandled = useRef(false);
  const { scope, setScope } = useMissionScope();
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
  const [operatingMode, setOperatingMode] = useState<OperatingMode>("founder");
  const [loopPhase, setLoopPhase] = useState<CapitalLoopPhase>("observe");

  useEffect(() => {
    async function bootstrap() {
      const available = await isMissionServerAvailable();
      setServerMode(available);
      if (!available) return;

      const local = loadMissionSessions();
      if (local.length > 0) {
        const result = await migrateLocalSessions(
          local.map((s) => ({
            title: s.title,
            query: s.query || s.scope || s.title,
            ecosystemId: s.ecosystemId,
            turns: s.turns?.map((t) => ({ role: t.role, text: t.text })),
          })),
        ).catch(() => undefined);
        if (result?.migrated && result.migrated > 0) {
          localStorage.removeItem("resolve-mission-sessions");
        }
      }
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

  useEffect(() => {
    if (!serverMode || treasuryBalanceUsd !== undefined) return;
    if (!showCapital && !objective) return;
    void fetchWorkbench().then((wb) => {
      if (wb) setTreasuryBalanceUsd(wb.treasury.balanceUsd);
    });
  }, [serverMode, showCapital, objective, treasuryBalanceUsd]);

  const showPolicies = useMemo(
    () => showCapital && policies.length > 0,
    [showCapital, policies.length],
  );

  const showTimeline = Boolean(objective && turns.length > 0);

  const lastResolveReport = useMemo(() => {
    const last = [...turns].reverse().find((t) => t.role === "resolve");
    return last?.report;
  }, [turns]);

  const topic = useMemo(
    () =>
      resolveMissionTopic({
        objective,
        workspaceName: activeWorkspace?.name,
        report: lastResolveReport,
      }),
    [objective, activeWorkspace?.name, lastResolveReport],
  );

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

  const ensureServerSession = useCallback(
    async (
      activeSession: MissionSession,
      trimmed: string,
      workspaceId?: string,
    ): Promise<MissionSession> => {
      if (!serverMode || !activeSession.id.startsWith("ms-")) return activeSession;
      const created = await createServerMission({
        title: trimmed.slice(0, 80),
        ecosystemId: workspaceId ?? activeSession.ecosystemId,
      });
      if (!created) return activeSession;
      const next = serverMissionToSession(created, activeWorkspace?.name);
      setSession(next);
      return next;
    },
    [serverMode, activeWorkspace?.name],
  );

  const persistSession = useCallback(
    async (
      activeSession: MissionSession,
      turnList: MissionTurn[],
      opts: {
        title?: string;
        findingCount?: number;
        phase?: MissionPhase;
        scope?: string;
        ecosystemId?: string;
        status?: string;
        capability?: string;
      },
    ) => {
      const title = sessionTitleFromTurns(turnList, opts.title ?? activeSession.title);

      if (serverMode && !activeSession.id.startsWith("ms-")) {
        const synced = await syncMissionSession(activeSession.id, {
          title,
          scope: opts.scope ?? title,
          status: opts.status,
          phase: opts.phase,
          capability: opts.capability,
          ecosystemId: opts.ecosystemId,
          findingCount: opts.findingCount,
          turns: missionTurnsToSyncInput(turnList),
        });
        if (synced) {
          setSession(serverMissionToSession(synced, activeWorkspace?.name));
        }
      } else {
        persistLocalSession(activeSession, turnList, { ...opts, title });
      }
      setLibraryTick((n) => n + 1);
    },
    [serverMode, activeWorkspace?.name],
  );

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

  const runAgentSignalMessage = useCallback(
    async (trimmed: string, serviceOverride?: string) => {
      const isFirstTurn = turns.length === 0;
      let activeSession = session;
      if (isFirstTurn) {
        activeSession = await ensureServerSession(
          session,
          trimmed,
          activeWorkspace?.id ?? session.ecosystemId,
        );
        setObjective(trimmed);
      }
      setLastIntent(trimmed);
      setInput("");
      setLoading(true);
      setThinkingComplete(false);
      setActiveThinkingSteps([...AGENT_SIGNAL_THINKING]);

      const userTurn: MissionTurn = { id: `u-${Date.now()}`, role: "user", text: trimmed };
      const nextTurns = [...turns, userTurn];
      setTurns(nextTurns);

      try {
        const matched = matchServiceForPrompt(trimmed);
        const serviceId = serviceOverride ?? matched?.id;
        const serviceName = matched?.name ?? "Agent signal";
        const priceUsd = matched?.priceUsd ?? 0.02;
        const billingUnit = matched?.billingUnit ?? "signal";

        setThinkingComplete(true);
        const resolveTurn: MissionTurn = {
          id: `r-${Date.now()}`,
          role: "resolve",
          text: agentSignalIntro(serviceName, priceUsd, billingUnit),
          phase: "discover",
          agentSignal: {
            prompt: trimmed,
            serviceId,
          },
        };
        const finalTurns = [...nextTurns, resolveTurn];
        setTurns(finalTurns);
        setLastPhase("discover");
        setLastCapability("general_inquiry");
        await persistSession(activeSession, finalTurns, {
          title: (objective ?? trimmed).slice(0, 48),
          phase: "discover",
          scope: objective ?? trimmed,
          ecosystemId: activeWorkspace?.id ?? activeSession.ecosystemId,
          capability: "general_inquiry",
        });
      } catch (e) {
        setThinkingComplete(true);
        setTurns([
          ...nextTurns,
          {
            id: `r-${Date.now()}`,
            role: "resolve",
            text: e instanceof Error ? e.message : "Could not prepare agent signal.",
            phase: "discover",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [turns, session, objective, activeWorkspace?.id, ensureServerSession, persistSession],
  );

  const runBlueprintMission = useCallback(
    async (trimmed: string) => {
      const isFirstTurn = turns.length === 0;
      let activeSession = session;
      if (isFirstTurn) {
        activeSession = await ensureServerSession(
          session,
          trimmed,
          activeWorkspace?.id ?? session.ecosystemId,
        );
        setObjective(trimmed);
      }
      setLastIntent(trimmed);
      setInput("");
      setLoading(true);
      setThinkingComplete(false);
      setActiveThinkingSteps([
        "Loading communal pool",
        "Resolving authorizations",
        "Building Blueprint",
        "Ready to simulate",
      ]);

      const slug =
        resolveMissionCommunitySlug({
          scopeLabel: scope?.label ?? trimmed,
          topicName: objective ?? trimmed,
        }) ?? "react";
      void prefetchMissionPool(slug);

      const userTurn: MissionTurn = { id: `u-${Date.now()}`, role: "user", text: trimmed };
      const nextTurns = [...turns, userTurn];
      setTurns(nextTurns);

      const budget = parseCapitalUsd(trimmed);
      setThinkingComplete(true);
      const resolveTurn: MissionTurn = {
        id: `r-${Date.now()}`,
        role: "resolve",
        text: "Settlement package ready — named payees below. Simulate, then authorize.",
        phase: "plan",
        blueprint: { prompt: trimmed, initialBudgetUsd: budget ?? undefined },
      };
      const finalTurns = [...nextTurns, resolveTurn];
      setTurns(finalTurns);
      setLastPhase("plan");
      setLastCapability("allocate_capital");
      setLoopPhase("simulate");
      setOperatingMode(detectOperatingMode(trimmed));
      await persistSession(activeSession, finalTurns, {
        title: (objective ?? trimmed).slice(0, 48),
        phase: "plan",
        scope: objective ?? trimmed,
        ecosystemId: activeWorkspace?.id ?? activeSession.ecosystemId,
        capability: "allocate_capital",
        status: "awaiting_user",
      });
      setLoading(false);
    },
    [turns, session, objective, activeWorkspace?.id, scope?.label, ensureServerSession, persistSession],
  );

  const sendMessage = useCallback(
    async (text: string, sessionOverride?: MissionSession, policyOverride?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      if (detectAgentSignalIntent(trimmed)) {
        const serviceOverride = searchParams.get("service") ?? undefined;
        await runAgentSignalMessage(trimmed, serviceOverride ?? undefined);
        return;
      }

      if (detectBlueprintIntent(trimmed)) {
        await runBlueprintMission(trimmed);
        return;
      }

      let activeSession = sessionOverride ?? session;
      const isFirstTurn = turns.length === 0;

      if (isFirstTurn) {
        activeSession = await ensureServerSession(
          activeSession,
          trimmed,
          activeWorkspace?.id ?? activeSession.ecosystemId,
        );
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
          {
            name: activeWorkspace.name,
            keywords: activeWorkspace.keywords,
            repos: activeWorkspace.repos?.map((r) => ({
              owner: r.owner,
              repo: r.repo,
              fullName: r.fullName,
            })),
            connectors: activeWorkspace.connectors,
          }
        : undefined;

      try {
        let data: AdvisorPayload;

        if (serverMode && !activeSession.id.startsWith("ms-")) {
          const serverData = await sendMissionMessage(activeSession.id, {
            question: query,
            messages: history,
            ecosystemId: workspaceId,
            operatingMode,
          });
          if (serverData) {
            data = serverData;
          } else {
            const res = await fetch("/api/workspace/ask", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                question: query,
                messages: history,
                ecosystem: workspacePayload,
                operatingMode,
              }),
            });
            const json = (await res.json()) as AdvisorPayload & { error?: string };
            if (!res.ok) throw new Error(json.error ?? "Analysis failed");
            data = json;
          }
        } else {
          const res = await fetch("/api/workspace/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: query,
              messages: history,
              ecosystem: workspacePayload,
              operatingMode,
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

        if (data.report?.operatingMode) setOperatingMode(data.report.operatingMode);
        else setOperatingMode(detectOperatingMode(trimmed, activeWorkspace?.kind as import("@/lib/mission/community/types").CommunityKind | undefined));
        if (data.report?.loopPhase) setLoopPhase(data.report.loopPhase);
        else {
          const job = detectMissionJob(trimmed, (data.capability ?? "general_inquiry") as import("@/lib/mission/capabilities/types").CapabilityId, phase, parseCapitalUsd(trimmed));
          setLoopPhase(detectCapitalLoopPhase(job, phase, trimmed));
        }

        if (serverMode && data.mission) {
          const updated = serverMissionToSession(data.mission, activeWorkspace?.name);
          setSession(updated);
          setMissionStatus(data.status ?? updated.status ?? null);
          void loadTimelineForMission(updated.id, workspaceId);
        } else {
          await persistSession(activeSession, finalTurns, {
            title: (objective ?? trimmed).slice(0, 48),
            findingCount: resolveTurn.findings?.length,
            phase,
            scope: objective ?? trimmed,
            ecosystemId: workspaceId,
            capability: data.capability ?? undefined,
            status: data.status,
          });
          captureFromMission({
            missionId: activeSession.id,
            missionTitle: objective ?? trimmed,
            ecosystemId: workspaceId,
            findings: resolveTurn.findings?.map((f) => ({ title: f.title, insight: f.insight })),
          });
        }
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
      turns,
      session,
      activeWorkspace,
      serverMode,
      objective,
      selectedPolicyId,
      operatingMode,
      runAgentSignalMessage,
      runBlueprintMission,
      searchParams,
      ensureServerSession,
      persistSession,
    ],
  );

  const handleAction = useCallback(
    async (action: CapabilityAction) => {
      const actionType = resolveMissionActionType(action);

      if (
        actionType === "navigate" ||
        actionType === "open_claim" ||
        actionType === "fund_treasury"
      ) {
        window.location.href =
          action.href ??
          (actionType === "open_claim" ? "/claim"
          : actionType === "fund_treasury" ? "/payments"
          : "/");
        return;
      }

      if (actionType !== "chat" && serverMode && !session.id.startsWith("ms-")) {
        setLoading(true);
        try {
          const result = await dispatchMissionAction({
            missionId: session.id,
            action,
            context: {
              objective: objective ?? undefined,
              summary: lastResolveReport?.summary,
              headline: lastResolveReport?.headline,
              ecosystemId: activeWorkspace?.id ?? session.ecosystemId,
              fundPoolUsd: parseCapitalUsd(objective ?? input) ?? undefined,
            },
          });

          if (result?.navigateTo) {
            window.location.href = result.navigateTo;
            return;
          }

          const isSettlement = actionType === "prepare_settlement" || actionType === "execute_settlement";
          const resolveTurn: MissionTurn = {
            id: `r-${Date.now()}`,
            role: "resolve",
            text: result?.message ?? "Action completed.",
            phase: isSettlement ? (actionType === "execute_settlement" ? "execute" : "plan") : "discover",
            capability: isSettlement ? "execute_settlement" : undefined,
          };
          setTurns((prev) => [...prev, resolveTurn]);
          setMissionStatus(
            actionType === "execute_settlement" ? "completed"
            : actionType === "prepare_settlement" ? "awaiting_user"
            : missionStatus,
          );
          setLibraryTick((n) => n + 1);
        } catch (e) {
          setTurns((prev) => [
            ...prev,
            {
              id: `r-${Date.now()}`,
              role: "resolve",
              text: e instanceof Error ? e.message : "Action failed",
              phase: "discover",
            },
          ]);
        } finally {
          setLoading(false);
        }
        return;
      }

      if (actionType === "prepare_settlement" || actionType === "execute_settlement") {
        if (serverMode && !session.id.startsWith("ms-")) {
          void runExecute(session.id, actionType === "execute_settlement");
          return;
        }
      }

      void sendMessage(action.prompt);
    },
    [
      runExecute,
      sendMessage,
      serverMode,
      session.id,
      session.ecosystemId,
      objective,
      input,
      lastResolveReport,
      activeWorkspace?.id,
      missionStatus,
    ],
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
    const intent = searchParams.get("intent");
    const scopedPrompt =
      intent === "fund" || scope.kind === "query"
        ? `Fund ${scope.label} maintainers based on verified contribution signals — $500`
        : scope.kind === "repository"
          ? `Fund maintainers for ${scope.label} based on verified contribution signals — $500`
          : detectBlueprintIntent(scope.label)
            ? scope.label
            : `Fund ${scope.label} maintainers — simulate $500 allocation`;
    void sendMessage(scopedPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope?.label]);

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (!prompt || urlPromptHandled.current || objective || turns.length > 0) return;
    urlPromptHandled.current = true;
    const service = searchParams.get("service") ?? undefined;
    if (detectAgentSignalIntent(prompt)) {
      void runAgentSignalMessage(prompt, service);
    } else {
      void sendMessage(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function handleNewMission() {
    setScope(null);
    const wsId = activeWorkspace?.id ?? getActiveEcosystemId() ?? undefined;

    if (serverMode) {
      const created = await createServerMission({ ecosystemId: wsId });
      setSession(created ? serverMissionToSession(created, activeWorkspace?.name) : createMissionSession(wsId));
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
    setOperatingMode("founder");
    setLoopPhase("observe");
    setMissionStatus("created");
  }

  async function handleSelectSession(s: MissionSession) {
    setScope(null);
    setObjective(s.scope ?? s.query ?? s.title);

    if (serverMode && !s.id.startsWith("ms-")) {
      const full = await fetchMission(s.id);
      if (full) {
        const restored = serverMissionToSession(full, activeWorkspace?.name ?? s.worldName);
        setSession(restored);
        setMissionStatus(restored.status ?? null);
        const turnList = turnsFromSession(restored);
        setTurns(turnList);
        const lastResolve = [...turnList].reverse().find((t) => t.role === "resolve");
        setLastPhase(lastResolve?.phase ?? restored.phase ?? "discover");
        if (turnList.some((t) => t.blueprint)) setLoopPhase("simulate");
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
    <MissionBlueprintCommandProvider>
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
        activeSessionId={session.id}
        missionId={session.id.startsWith("ms-") ? null : session.id}
        libraryTick={libraryTick}
        policies={policies}
        selectedPolicyId={selectedPolicyId}
        onSelectPolicy={handlePolicySelect}
        showCapital={showCapital}
        showPolicies={showPolicies}
        showTimeline={showTimeline}
        timeline={timeline}
        timelineLoading={timelineLoading}
        treasuryBalanceUsd={treasuryBalanceUsd}
        topic={topic}
        operatingMode={operatingMode}
        loopPhase={loopPhase}
        onOperatingModeChange={setOperatingMode}
      />
    </MissionBlueprintCommandProvider>
  );
}
