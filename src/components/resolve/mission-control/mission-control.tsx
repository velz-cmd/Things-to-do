"use client";

import { useCallback, useEffect, useState } from "react";
import { useMissionScope } from "@/lib/mission/mission-context";
import { MissionWorkspace, type MissionTurn } from "@/components/resolve/mission-control/mission-workspace";
import type { AllocationLine } from "@/components/resolve/mission-control/mission-recommendation";
import type { OpportunityCard } from "@/lib/workspace/advisors/opportunity-cards";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { MissionFinding } from "@/lib/workspace/advisors/intelligence-findings";
import type { MissionPhase } from "@/lib/mission/phases";
import { buildContextualActions, chipsFromFinding, detectMissionPhase } from "@/lib/mission/phases";
import { detectMissionIntent, parseCapitalUsd, thinkingStepsFor } from "@/lib/mission/intents";
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

function persistSession(
  session: MissionSession,
  turns: MissionTurn[],
  opts: {
    title?: string;
    findingCount?: number;
    phase?: MissionPhase;
    scope?: string;
    ecosystemId?: string;
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
    findingCount: opts.findingCount,
    lastFindings: lastResolve?.findings,
    turns: turns.map((t) => ({
      id: t.id,
      role: t.role,
      text: t.text,
      phase: t.phase,
      findings: t.findings,
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
  }));
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

      const ecosystemPayload =
        activeEcosystem ?
          { name: activeEcosystem.name, keywords: activeEcosystem.keywords }
        : undefined;

      try {
        const res = await fetch("/api/workspace/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            messages: history,
            ecosystem: ecosystemPayload,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Analysis failed");

        setThinkingComplete(true);

        const phase: MissionPhase = data.phase ?? detectMissionPhase(trimmed, history);
        setLastPhase(phase);

        const findings = enrichFindings(data.findings ?? []);
        const estCapital = parseCapitalUsd(trimmed);
        const opportunities: OpportunityCard[] = data.opportunities ?? [];
        const policies: PolicyProposal[] = data.policies ?? [];
        const isPlan = phase === "plan";
        const answer = data.answer ?? data.headline ?? "No analysis available.";

        const nextSteps = buildContextualActions({
          phase,
          findings,
          turnCount: nextTurns.filter((t) => t.role === "user").length,
          lastUserText: trimmed,
        });

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
          nextSteps,
        };

        const finalTurns = [...nextTurns, resolveTurn];
        setTurns(finalTurns);

        const title = trimmed.slice(0, 48) + (trimmed.length > 48 ? "…" : "");
        persistSession(activeSession, finalTurns, {
          title,
          findingCount: findings.length,
          phase,
          scope: nextTurns.find((t) => t.role === "user")?.text,
          ecosystemId: activeEcosystem?.id ?? activeSession.ecosystemId,
        });

        captureFromMission({
          missionId: activeSession.id,
          missionTitle: title,
          ecosystemId: activeEcosystem?.id ?? activeSession.ecosystemId,
          findings: findings.map((f) => ({ title: f.title, insight: f.insight })),
        });

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
        persistSession(activeSession, finalTurns, {
          ecosystemId: activeEcosystem?.id ?? activeSession.ecosystemId,
        });
        setLibraryTick((n) => n + 1);
      } finally {
        setLoading(false);
      }
    },
    [enterMission, turns, session, activeEcosystem],
  );

  useEffect(() => {
    if (!scope?.label || started) return;
    void sendMessage(scope.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap from URL scope once
  }, [scope?.label]);

  function handleNewMission() {
    setScope(null);
    const ecoId = activeEcosystem?.id ?? getActiveEcosystemId() ?? undefined;
    setSession(createMissionSession(ecoId));
    setTurns([]);
    setInput("");
    setThinkingComplete(false);
    setLastPhase("discover");
  }

  function handleSelectSession(s: MissionSession) {
    setScope(null);
    setSession(s);
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
        handleSelectSession(s);
        return;
      }
    }
    void sendMessage(`Continue from: ${entry.title} — ${entry.summary}`);
  }

  function handleClear() {
    handleNewMission();
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
      onNewMission={handleNewMission}
      onSelectSession={handleSelectSession}
      onSelectEcosystem={handleSelectEcosystem}
      onSelectKnowledge={handleSelectKnowledge}
      activeSessionId={session.id}
      activeEcosystem={activeEcosystem}
      onClear={handleClear}
      libraryTick={libraryTick}
    />
  );
}
