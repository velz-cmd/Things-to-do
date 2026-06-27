import { gatherWorkspaceEvidence } from "@/lib/workspace/context";
import { scanFundingOpportunity } from "@/lib/github/opportunities";
import { parseRepoInput } from "@/lib/workspace/parse-repo";
import { buildPolicyProposals } from "@/lib/workspace/advisors/policy-proposals";
import { buildValueConcentrations } from "@/lib/workspace/advisors/concentrations";
import { opportunitiesToCards } from "@/lib/workspace/advisors/opportunity-cards";
import { collectUpstreamUsageSignals } from "@/lib/connectors/upstream";
import { pingListenBrainz, fetchListenBrainzListens } from "@/lib/integrations/listenbrainz";
import { pingNavidrome } from "@/lib/integrations/navidrome";
import type { FundingOpportunity } from "@/lib/github/types";
import {
  buildCommunityContext,
  hasSensor,
  type CommunityContext,
  type CapabilityLayer,
} from "@/lib/mission/community";
import type { CapabilityId, CollectorTrace, CommunityRepoRef, DataSource } from "./types";
import { getCapabilityDef } from "./registry";

function trace(
  source: DataSource,
  status: CollectorTrace["status"],
  summary: string,
  layer?: CapabilityLayer,
): CollectorTrace {
  return { source, status, summary, layer };
}

function mergeOpportunities(
  base: FundingOpportunity[],
  extra: FundingOpportunity[],
): FundingOpportunity[] {
  const map = new Map<string, FundingOpportunity>();
  for (const o of [...base, ...extra]) map.set(o.id, o);
  return [...map.values()].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2 };
    const d = order[a.priority] - order[b.priority];
    if (d !== 0) return d;
    return b.health.fundingGapUsd - a.health.fundingGapUsd;
  });
}

function filterByScope(opportunities: FundingOpportunity[], scope: string | null): FundingOpportunity[] {
  if (!scope) return opportunities;
  const q = scope.toLowerCase();
  return opportunities.filter(
    (o) =>
      o.fullName.toLowerCase().includes(q) ||
      o.repo.toLowerCase().includes(q) ||
      (q.includes("react") && (o.fullName.includes("next") || o.repo.includes("react"))),
  );
}

function filterByTargets(opportunities: FundingOpportunity[], targets: string[]): FundingOpportunity[] {
  if (!targets.length) return opportunities;
  return opportunities.filter((o) => {
    const name = o.fullName.toLowerCase();
    return targets.some(
      (t) =>
        name.includes(t.toLowerCase()) ||
        o.repo.toLowerCase().includes(t.toLowerCase()) ||
        (t.toLowerCase().includes("react") && name.includes("next")),
    );
  });
}

function wantsLayer(community: CommunityContext, layer: CapabilityLayer): boolean {
  return community.layersRequested.includes(layer);
}

/** Mandatory evidence collection — sensors resolved from community kind + capability layers. */
export async function runCollectors(input: {
  capability: CapabilityId;
  question: string;
  community?: {
    name: string;
    kind?: string;
    keywords?: string[];
    repos?: CommunityRepoRef[];
    connectors?: string[];
  };
}): Promise<{
  evidence: Awaited<ReturnType<typeof gatherWorkspaceEvidence>>;
  opportunities: FundingOpportunity[];
  policies: ReturnType<typeof buildPolicyProposals>;
  concentrations: ReturnType<typeof buildValueConcentrations>;
  opportunityCards: ReturnType<typeof opportunitiesToCards>;
  traces: CollectorTrace[];
  community: CommunityContext;
  compareTargets: string[];
  communityScope: string | null;
  stepsRun: string[];
}> {
  const def = getCapabilityDef(input.capability);
  const community = buildCommunityContext({
    question: input.question,
    requiredLayers: def.requiredLayers,
    community: input.community,
  });

  const traces: CollectorTrace[] = [];
  const stepsRun: string[] = [`Detecting ${community.kindLabel} community`];

  stepsRun.push("Gathering workspace evidence");
  const evidence = await gatherWorkspaceEvidence();

  if (wantsLayer(community, "capital") || wantsLayer(community, "verify")) {
    traces.push(
      trace(
        "treasury",
        "ok",
        `Treasury $${evidence.treasury.balanceUsd.toFixed(0)} · obligations $${evidence.treasury.obligationsUsd.toFixed(0)}`,
        "capital",
      ),
    );
  }

  if (wantsLayer(community, "attribute") || wantsLayer(community, "verify")) {
    if (evidence.ledger) {
      traces.push(
        trace(
          "ledger",
          "ok",
          `${evidence.ledger.count} authorizations · $${evidence.ledger.claimableUsd.toFixed(0)} claimable`,
          "attribute",
        ),
      );
    } else {
      traces.push(trace("ledger", "empty", "No authorization ledger entries", "attribute"));
    }
  }

  if (wantsLayer(community, "observe")) {
    const healthy = evidence.connectors.filter((c) => c.health === "healthy").length;
    traces.push(
      trace(
        "connectors",
        healthy > 0 ? "ok" : "empty",
        `${healthy}/${evidence.connectors.length} observation sensors live`,
        "observe",
      ),
    );
  }

  let opportunities = [...evidence.opportunities];

  const communityRepos = input.community?.repos ?? [];
  const observeCode =
    hasSensor(community.sensors, "github") &&
    (community.kind === "oss" || community.kind === "protocol" || community.kind === "general");

  if (observeCode && communityRepos.length > 0) {
    stepsRun.push(`Observing ${communityRepos.length} attached signals`);
    for (const r of communityRepos.slice(0, 6)) {
      const scanned = await scanFundingOpportunity(r.owner, r.repo).catch(() => null);
      if (scanned) {
        opportunities = mergeOpportunities(opportunities, [scanned]);
        traces.push(trace("github", "ok", `Community signal: ${scanned.fullName}`, "observe"));
      }
      if (hasSensor(community.sensors, "upstream")) {
        const upstream = await collectUpstreamUsageSignals(r.owner, r.repo).catch(() => null);
        if (upstream?.openAlex?.citations) {
          traces.push(
            trace(
              "openalex",
              "ok",
              `${r.fullName}: ${upstream.openAlex.citations.toLocaleString()} citations`,
              "understand",
            ),
          );
        } else if (upstream?.summary.length) {
          traces.push(trace("upstream", "ok", `${r.fullName}: ${upstream.summary[0]}`, "understand"));
        }
      }
    }
  }

  if (observeCode && hasSensor(community.sensors, "github")) {
    stepsRun.push("Observing code community signals");
    const parsed = parseRepoInput(input.question);
    if (parsed) {
      const scanned = await scanFundingOpportunity(parsed.owner, parsed.repo);
      if (scanned) {
        opportunities = mergeOpportunities(opportunities, [scanned]);
        traces.push(trace("github", "ok", `Live observation: ${scanned.fullName}`, "observe"));
      }
    } else if (!communityRepos.length && community.kind !== "music" && community.kind !== "research") {
      traces.push(
        trace(
          "github",
          opportunities.length > 0 ? "ok" : "empty",
          `${opportunities.length} code communities in observation set`,
          "observe",
        ),
      );
    }
  }

  if (community.kind === "music" || hasSensor(community.sensors, "listenbrainz")) {
    stepsRun.push("Observing music community signals");
    const lb = await pingListenBrainz().catch(() => ({ ok: false, message: "unavailable" }));
    if (lb.ok) {
      const listens = await fetchListenBrainzListens(5).catch(() => []);
      traces.push(
        trace(
          "music",
          "ok",
          listens.length ?
            `ListenBrainz · ${listens.length} recent listens`
          : lb.message,
          "observe",
        ),
      );
    } else {
      traces.push(
        trace("music", "empty", "Connect ListenBrainz on Profile to observe music communities", "observe"),
      );
    }
    const nd = await pingNavidrome().catch(() => ({ ok: false, message: "unavailable" }));
    if (nd.ok) {
      traces.push(trace("music", "ok", nd.message, "observe"));
    }
  }

  if (community.kind === "research" || hasSensor(community.sensors, "openalex")) {
    stepsRun.push("Observing research community signals");
    traces.push(
      trace(
        "openalex",
        evidence.integrations?.live?.openAlex?.ok ? "ok" : "empty",
        evidence.integrations?.live?.openAlex?.ok ?
          "OpenAlex research graph available"
        : "Research observation expands with OpenAlex integration",
        "observe",
      ),
    );
  }

  const ecoConnectors = input.community?.connectors ?? [];
  for (const connectorId of ecoConnectors) {
    const live = evidence.connectors.find((c) => c.id === connectorId);
    if (live) {
      traces.push(
        trace(
          "connectors",
          live.health === "healthy" ? "ok" : "empty",
          `${live.label}: ${live.eventsToday} events today`,
          "observe",
        ),
      );
    }
  }

  const compareTargets =
    community.compareTargets.length ? community.compareTargets : [];

  const communityScope = community.name ?? compareTargets[0] ?? null;

  if (input.capability === "compare_ecosystems" && compareTargets.length >= 2) {
    stepsRun.push(`Comparing ${compareTargets.join(" vs ")}`);
    opportunities = filterByTargets(opportunities, compareTargets);
  } else if (communityScope && input.capability !== "general_inquiry") {
    stepsRun.push(`Scoping to ${communityScope}`);
    if (observeCode) {
      opportunities = filterByScope(opportunities, communityScope);
    }
  }

  const policies =
    wantsLayer(community, "understand") || wantsLayer(community, "capital") ?
      buildPolicyProposals(evidence)
    : [];
  if (policies.length) {
    traces.push(trace("policies", "ok", `${policies.length} allocation philosophies loaded`, "understand"));
  }

  const concentrations = wantsLayer(community, "understand")
    ? buildValueConcentrations({ ...evidence, opportunities })
    : [];
  if (concentrations.length) {
    traces.push(
      trace("concentrations", "ok", `${concentrations.length} value concentrations`, "understand"),
    );
  }

  for (const step of def.steps) {
    if (!stepsRun.includes(step)) stepsRun.push(step);
  }

  return {
    evidence: { ...evidence, opportunities },
    opportunities,
    policies,
    concentrations,
    opportunityCards: opportunitiesToCards(opportunities),
    traces,
    community,
    compareTargets,
    communityScope,
    stepsRun,
  };
}
