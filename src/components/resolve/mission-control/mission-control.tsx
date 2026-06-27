"use client";

import { useCallback, useEffect, useState } from "react";
import { useMissionScope } from "@/lib/mission/mission-context";
import { MissionWorkspace, type MissionTurn } from "@/components/resolve/mission-control/mission-workspace";
import type { AllocationLine } from "@/components/resolve/mission-control/mission-recommendation";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { MissionPhase } from "@/lib/mission/phases";
import {
  chipsFromFinding,
  detectMissionPhase,
  executeActions,
  planningActions,
} from "@/lib/mission/phases";
import { detectMissionIntent, parseCapitalUsd, thinkingStepsFor } from "@/lib/mission/intents";
import {
  createMissionSession,
  upsertMissionSession,
  type MissionSession,
} from "@/lib/mission/toolbox/mission-library";

const AGENT_STARTER =
  "Deploy economic agents across my connected ecosystems — scan dependencies, treasury, and funding gaps.";

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
  if (/\b(conserv|stable|safe)\b/i.test(text)) {
    return policies.find((p) => p.id === "infrastructure") ?? policies[0];
  }
  if (/\b(aggress|growth|meme)\b/i.test(text)) {
    return policies.find((p) => p.id === "growth") ?? policies[0];
  }
  return policies.find((p) => p.id === "balanced") ?? policies[0];
}

function enrichFindingChips(
  findings: MissionFinding[],
  intent: ReturnType<typeof detectMissionIntent>,
): MissionFinding[] {
  return findings.map((f) => ({
    ...f,
    chips: chipsFromFinding(f, intent),
  }));
}

function persistSession(
  session: MissionSession,
  turns: MissionTurn[],
  title?: string,
  findingCount?: number,
) {
  const firstUser = turns.find((t) => t.role === "user");
  upsertMissionSession({
    ...session,
    title: title ?? session.title,
    query: firstUser?.text ?? session.query,
    findingCount,
    turns: turns.map((t) => ({ id: t.id, role: t.role, text: t.text })),
  });
}

export function MissionControl() {
  const { scope, setScope, enterMission } = useMissionScope();
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<MissionTurn[]>([]);
  const [session, setSession] = useState<MissionSession>(() => createMissionSession("mission"));
  const [loading, setLoading] = useState(false);
  const [thinkingComplete, setThinkingComplete] = useState(false);
  const [activeThinkingSteps, setActiveThinkingSteps] = useState<readonly string[]>(
    thinkingStepsFor("general"),
  );
  const [lastPhase, setLastPhase] = useState<MissionPhase>("discover");
  const [libraryTick, setLibraryTick] = useState(0);
  const started = turns.length > 0;

  const sendMessage = useCallback(
    async (text: string, sessionOverride?: MissionSession) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const activeSession = sessionOverride ?? session;
      const intent = detectMissionIntent(trimmed);
      setActiveThinkingSteps(thinkingStepsFor(intent));
      setInput("");
      setLoading(true);
      setThinkingComplete(false);
      enterMission(trimmed);

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

      try {
        const res = await fetch("/api/workspace/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: trimmed, messages: history }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Analysis failed");

        setThinkingComplete(true);

        const phase: MissionPhase = data.phase ?? detectMissionPhase(trimmed, history);
        setLastPhase(phase);

        const findings = enrichFindingChips(data.findings ?? [], intent);
        const estCapital = parseCapitalUsd(trimmed);
        const opportunities: OpportunityCard[] = data.opportunities ?? [];
        const policies: PolicyProposal[] = data.policies ?? [];
        const isPlan = phase === "plan";
        const answer = data.answer ?? data.headline ?? "No analysis available.";

        const resolveTurn: MissionTurn = {
          id: `r-${Date.now()}`,
          role: "resolve",
          text: answer,
          findings: phase === "discover" || findings.length > 0 ? findings : undefined,
          phase,
          allocations:
            isPlan && estCapital ?
              buildAllocationFromOpportunities(opportunities, estCapital)
            : undefined,
          policy: isPlan ? pickInlinePolicy(policies, trimmed) : undefined,
        };

        const finalTurns = [...nextTurns, resolveTurn];
        setTurns(finalTurns);

        const title = trimmed.slice(0, 48) + (trimmed.length > 48 ? "…" : "");
        persistSession(activeSession, finalTurns, title, findings.length);
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
        persistSession(activeSession, finalTurns);
        setLibraryTick((n) => n + 1);
      } finally {
        setLoading(false);
      }
    },
    [enterMission, turns, session],
  );

  useEffect(() => {
    if (!scope?.label || started) return;
    void sendMessage(scope.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap from URL scope once
  }, [scope?.label]);

  function handleNewMission() {
    setScope(null);
    setSession(createMissionSession("mission"));
    setTurns([]);
    setInput("");
    setThinkingComplete(false);
    setLastPhase("discover");
  }

  function handleNewAgent() {
    setScope(null);
    const next = createMissionSession("agent");
    setSession(next);
    setTurns([]);
    setInput("");
    setThinkingComplete(false);
    setLastPhase("discover");
    void sendMessage(AGENT_STARTER, next);
  }

  function handleSelectSession(s: MissionSession) {
    setScope(null);
    setSession(s);
    if (s.turns && s.turns.length > 0) {
      setTurns(s.turns as MissionTurn[]);
      setLastPhase("discover");
    } else if (s.query) {
      setTurns([]);
      void sendMessage(s.query, s);
    }
  }

  function handleClear() {
    handleNewMission();
  }

  const topFinding = [...turns].reverse().find((t) => t.role === "resolve")?.findings?.[0];

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
      onNewMission={handleNewMission}
      onNewAgent={handleNewAgent}
      onSelectSession={handleSelectSession}
      activeSessionId={session.id}
      onPlanningAction={(p) => void sendMessage(p)}
      onExecuteAction={(p) => void sendMessage(p)}
      onClear={handleClear}
      planningActions={planningActions(topFinding)}
      executeActions={executeActions()}
      libraryTick={libraryTick}
    />
  );
}
