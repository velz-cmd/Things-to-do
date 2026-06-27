import { gatherWorkspaceEvidence } from "@/lib/workspace/context";
import { scanFundingOpportunity } from "@/lib/github/opportunities";
import { parseRepoInput } from "@/lib/workspace/parse-repo";
import { buildPolicyProposals } from "@/lib/workspace/advisors/policy-proposals";
import { buildValueConcentrations } from "@/lib/workspace/advisors/concentrations";
import { opportunitiesToCards } from "@/lib/workspace/advisors/opportunity-cards";
import { collectUpstreamUsageSignals } from "@/lib/connectors/upstream";
import type { FundingOpportunity } from "@/lib/github/types";
import type { CapabilityId, CollectorTrace, DataSource, EcosystemRepoRef } from "./types";
import { extractCompareTargets, extractEcosystemScope } from "./intent-classifier";
import { getCapabilityDef } from "./registry";

function trace(source: DataSource, status: CollectorTrace["status"], summary: string): CollectorTrace {
  return { source, status, summary };
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
        name.includes(t) ||
        o.repo.toLowerCase().includes(t) ||
        (t.includes("react") && name.includes("next")),
    );
  });
}

/** Mandatory API/data collection before any LLM call. */
export async function runCollectors(input: {
  capability: CapabilityId;
  question: string;
  ecosystem?: {
    name: string;
    keywords?: string[];
    repos?: EcosystemRepoRef[];
    connectors?: string[];
  };
}): Promise<{
  evidence: Awaited<ReturnType<typeof gatherWorkspaceEvidence>>;
  opportunities: FundingOpportunity[];
  policies: ReturnType<typeof buildPolicyProposals>;
  concentrations: ReturnType<typeof buildValueConcentrations>;
  opportunityCards: ReturnType<typeof opportunitiesToCards>;
  traces: CollectorTrace[];
  compareTargets: string[];
  ecosystemScope: string | null;
  stepsRun: string[];
}> {
  const def = getCapabilityDef(input.capability);
  const traces: CollectorTrace[] = [];
  const stepsRun: string[] = [];

  stepsRun.push("Gathering workspace evidence");
  const evidence = await gatherWorkspaceEvidence();
  traces.push(
    trace("treasury", "ok", `Treasury $${evidence.treasury.balanceUsd.toFixed(0)} · obligations $${evidence.treasury.obligationsUsd.toFixed(0)}`),
  );

  if (evidence.ledger) {
    traces.push(
      trace("ledger", "ok", `${evidence.ledger.count} authorizations · $${evidence.ledger.claimableUsd.toFixed(0)} claimable`),
    );
  } else {
    traces.push(trace("ledger", "empty", "No authorization ledger entries"));
  }

  const healthy = evidence.connectors.filter((c) => c.health === "healthy").length;
  traces.push(
    trace(
      "connectors",
      healthy > 0 ? "ok" : "empty",
      `${healthy}/${evidence.connectors.length} sensors healthy`,
    ),
  );

  let opportunities = [...evidence.opportunities];

  const ecosystemRepos = input.ecosystem?.repos ?? [];
  if (ecosystemRepos.length > 0) {
    stepsRun.push(`Scanning ${ecosystemRepos.length} attached repositories`);
    for (const r of ecosystemRepos.slice(0, 6)) {
      const scanned = await scanFundingOpportunity(r.owner, r.repo).catch(() => null);
      if (scanned) {
        opportunities = mergeOpportunities(opportunities, [scanned]);
        traces.push(trace("github", "ok", `Ecosystem repo: ${scanned.fullName}`));
      }
      const upstream = await collectUpstreamUsageSignals(r.owner, r.repo).catch(() => null);
      if (upstream?.openAlex?.citations) {
        traces.push(
          trace(
            "openalex",
            "ok",
            `${r.fullName}: ${upstream.openAlex.citations.toLocaleString()} citations`,
          ),
        );
      } else if (upstream?.summary.length) {
        traces.push(trace("upstream", "ok", `${r.fullName}: ${upstream.summary[0]}`));
      }
    }
  }

  if (def.requiredSources.includes("github")) {
    stepsRun.push("Scanning repository opportunities");
    const parsed = parseRepoInput(input.question);
    if (parsed) {
      const scanned = await scanFundingOpportunity(parsed.owner, parsed.repo);
      if (scanned) {
        opportunities = mergeOpportunities(opportunities, [scanned]);
        traces.push(trace("github", "ok", `Live scan: ${scanned.fullName}`));
      }
    } else if (!ecosystemRepos.length) {
      traces.push(
        trace(
          "github",
          opportunities.length > 0 ? "ok" : "empty",
          `${opportunities.length} repositories in radar`,
        ),
      );
    }
  }

  const ecoConnectors = input.ecosystem?.connectors ?? [];
  for (const connectorId of ecoConnectors) {
    const live = evidence.connectors.find((c) => c.id === connectorId);
    if (live) {
      traces.push(
        trace(
          "connectors",
          live.health === "healthy" ? "ok" : "empty",
          `${live.label}: ${live.eventsToday} events today`,
        ),
      );
    }
  }

  const compareTargets = extractCompareTargets(input.question);
  const ecosystemScope =
    input.ecosystem?.name ??
    extractEcosystemScope(input.question, input.ecosystem?.keywords) ??
    null;

  if (input.capability === "compare_ecosystems" && compareTargets.length >= 2) {
    stepsRun.push(`Comparing ${compareTargets.join(" vs ")}`);
    opportunities = filterByTargets(opportunities, compareTargets);
  } else if (ecosystemScope && input.capability !== "general_inquiry") {
    stepsRun.push(`Scoping to ${ecosystemScope}`);
    opportunities = filterByScope(opportunities, ecosystemScope);
  }

  const policies = def.requiredSources.includes("policies") ? buildPolicyProposals(evidence) : [];
  if (policies.length) {
    traces.push(trace("policies", "ok", `${policies.length} allocation philosophies loaded`));
  }

  const concentrations = def.requiredSources.includes("concentrations")
    ? buildValueConcentrations({ ...evidence, opportunities })
    : [];
  if (concentrations.length) {
    traces.push(trace("concentrations", "ok", `${concentrations.length} value concentrations`));
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
    compareTargets,
    ecosystemScope,
    stepsRun,
  };
}
