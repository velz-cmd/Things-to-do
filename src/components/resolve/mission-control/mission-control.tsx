"use client";

import { useCallback, useEffect, useState } from "react";
import { useMissionScope } from "@/lib/mission/mission-context";
import { parseRepoInput } from "@/lib/workspace/parse-repo";
import { MissionInput } from "@/components/resolve/mission-control/mission-input";
import { MissionBrief, type MissionBriefData } from "@/components/resolve/mission-control/mission-brief";
import {
  IntelligenceWorkspace,
  type IntelligenceMessage,
} from "@/components/resolve/mission-control/intelligence-workspace";
import { MissionActionPanel } from "@/components/resolve/mission-control/mission-action-panel";
import { MissionEcosystemChain } from "@/components/resolve/mission-control/mission-ecosystem-chain";
import type { EvidenceAction } from "@/lib/workspace/advisors/evidence-actions";
import type { PolicyProposal } from "@/lib/workspace/advisors/policy-proposals";
import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";

const SOURCE_LABELS: Record<string, string> = {
  github: "GitHub",
  navidrome: "Navidrome",
  openalex: "OpenAlex",
  musicbrainz: "MusicBrainz",
  listenbrainz: "ListenBrainz",
};

function parseCapitalUsd(text: string): number | undefined {
  const m = text.match(/\$?\s*([\d,]+)\s*(k|K)?/);
  if (!m) return undefined;
  const n = Number(m[1].replace(/,/g, ""));
  if (Number.isNaN(n)) return undefined;
  return m[2] ? n * 1000 : n;
}

function fundingIntent(text: string): boolean {
  return /\b(distribut|fund|allocat|\$\d|treasury|capital)\b/i.test(text);
}

type OverviewSnapshot = {
  treasury?: { balanceUsd: number; obligationsUsd: number; availableUsd: number };
  network?: { ecosystemsConnected: number };
  domainIntelligence?: { label: string }[];
};

/**
 * Mission Control — operating room. Four regions: input, brief, intelligence, actions.
 * @see user spec — no sidebar nav, no BI cards, no empty global graph.
 */
export function MissionControl() {
  const { scope, enterMission } = useMissionScope();
  const [input, setInput] = useState("");
  const [objective, setObjective] = useState<string | null>(null);
  const [brief, setBrief] = useState<MissionBriefData | null>(null);
  const [messages, setMessages] = useState<IntelligenceMessage[]>([]);
  const [actions, setActions] = useState<EvidenceAction[]>([]);
  const [policies, setPolicies] = useState<PolicyProposal[]>([]);
  const [concentrations, setConcentrations] = useState<ValueConcentration[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [overview, setOverview] = useState<OverviewSnapshot | null>(null);

  useEffect(() => {
    void fetch("/api/workspace/overview")
      .then((r) => r.json())
      .then((d) => setOverview(d))
      .catch(() => setOverview(null));
  }, []);

  const runMission = useCallback(
    async (text: string) => {
      setObjective(text);
      setLoading(true);
      setShowPolicies(fundingIntent(text));
      enterMission(text);

      const parsed = parseRepoInput(text);
      const scopeLabel = parsed ? `${parsed.owner}/${parsed.repo}` : text.slice(0, 80);
      const estCapital = parseCapitalUsd(text);

      const liveSources: string[] = [];
      if (overview?.network?.ecosystemsConnected) {
        liveSources.push(`${overview.network.ecosystemsConnected} sensor(s) online`);
      }

      setBrief({
        objective: text,
        scope: scopeLabel,
        status: "analyzing",
        estimatedCapitalUsd: estCapital,
        affectedCommunities: overview?.domainIntelligence?.length ?? 0,
        evidenceSources: liveSources,
        capitalAvailableUsd: overview?.treasury?.availableUsd ?? overview?.treasury?.balanceUsd ?? 0,
        capitalRequiredUsd: overview?.treasury?.obligationsUsd ?? estCapital ?? 0,
      });

      setMessages((m) => [...m, { role: "user", text }]);

      try {
        const res = await fetch("/api/workspace/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Analysis failed");

        const conc: ValueConcentration[] = data.concentrations ?? [];
        setConcentrations(conc);
        setActions(data.actions ?? []);
        setPolicies(data.policies ?? []);

        setMessages((m) => [
          ...m,
          {
            role: "resolve",
            text: data.answer ?? "No analysis available.",
            concentrations: conc,
            evidenceUsed: data.evidenceUsed,
          },
        ]);

        const connectorSources = (data.evidenceUsed ?? [])
          .filter((e: string) => e.includes("."))
          .map((e: string) => e.split(".")[0])
          .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)
          .map((id: string) => SOURCE_LABELS[id] ?? id);

        setBrief((b) =>
          b
            ? {
                ...b,
                status: "ready",
                confidence: data.grounded ? 0.85 : 0.65,
                evidenceSources: connectorSources.length > 0 ? connectorSources : b.evidenceSources,
                affectedCommunities: conc.length > 0 ? conc.length : b.affectedCommunities,
              }
            : null,
        );
      } catch (e) {
        setMessages((m) => [
          ...m,
          {
            role: "resolve",
            text: e instanceof Error ? e.message : "Could not complete analysis.",
          },
        ]);
        setBrief((b) => (b ? { ...b, status: "error" } : null));
      } finally {
        setLoading(false);
      }
    },
    [enterMission, overview],
  );

  useEffect(() => {
    if (!scope?.label || objective) return;
    setInput(scope.label);
    void runMission(scope.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when URL scope appears
  }, [scope?.label]);

  function handleReject() {
    setShowPolicies(false);
    setSelectedPolicyId(null);
    setActions([]);
  }

  const missionActive = Boolean(objective);
  const scopeLabel = brief?.scope ?? scope?.label ?? "";

  return (
    <div className="flex h-[calc(100vh-3.75rem)] min-h-[560px] flex-col overflow-hidden">
      <MissionInput
        value={input}
        onChange={setInput}
        onSubmit={(t) => void runMission(t)}
        loading={loading}
        compact={missionActive}
      />

      {missionActive && scopeLabel && (
        <MissionEcosystemChain scope={scopeLabel} concentrations={concentrations} />
      )}

      <div className="flex min-h-0 flex-1">
        <MissionBrief brief={brief} />
        <IntelligenceWorkspace messages={messages} loading={loading} idle={!missionActive} />
        <MissionActionPanel
          actions={actions}
          policies={policies}
          showPolicies={showPolicies}
          selectedPolicyId={selectedPolicyId}
          onSelectPolicy={setSelectedPolicyId}
          onReject={handleReject}
          missionActive={missionActive}
        />
      </div>
    </div>
  );
}
