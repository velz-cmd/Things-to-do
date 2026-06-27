import type { CapabilityId, CapabilityAction, OrchestratorContext, CapabilityDef } from "./types";

function topFinding(ctx: OrchestratorContext) {
  return ctx.findings[0];
}

function communityLabel(ctx: OrchestratorContext): string {
  return ctx.communityName ?? ctx.community.name ?? ctx.community.kindLabel;
}

export const CAPABILITY_REGISTRY: Record<CapabilityId, CapabilityDef> = {
  discover_value_leaks: {
    id: "discover_value_leaks",
    label: "Find value leaks",
    purpose: "Locate unfunded value and concentration across observed communities",
    requiredLayers: ["observe", "understand", "capital", "attribute"],
    steps: [
      "Observing community signals",
      "Measuring funding gaps",
      "Mapping value concentration",
      "Checking treasury coverage",
      "Ranking value leaks",
    ],
    actions(ctx) {
      const top = topFinding(ctx);
      const actions: CapabilityAction[] = [];
      if (top?.id === "funding-gap") {
        actions.push({
          id: "rank-impact",
          label: "Rank where capital matters most",
          prompt: `Rank ${communityLabel(ctx)} by where capital would reduce the most unfunded value.`,
          kind: "explore",
        });
      }
      if (top?.id === "maintainer-risk") {
        actions.push({
          id: "map-deps",
          label: `Map who depends on ${top.title.split("/")[1] ?? top.title}`,
          prompt: `Map downstream exposure for ${top.title}.`,
          kind: "explore",
        });
      }
      if (ctx.capitalUsd) {
        actions.push({
          id: "simulate",
          label: "Simulate plugging these leaks",
          prompt: `Simulate allocating $${ctx.capitalUsd.toLocaleString()} to the highest-impact leaks.`,
          kind: "simulate",
        });
      } else {
        actions.push({
          id: "plan",
          label: "Turn leaks into a funding plan",
          prompt: "Build a capital plan targeting the largest observed leaks.",
          kind: "plan",
        });
      }
      if (ctx.evidence.opportunities.length > 0) {
        actions.push({
          id: "watch",
          label: "Watch these communities",
          prompt: "What changed across these communities in the last week?",
          kind: "explore",
        });
      }
      return actions.slice(0, 3);
    },
  },

  allocate_capital: {
    id: "allocate_capital",
    label: "Allocate capital",
    purpose: "Propose evidence-backed allocation from treasury, gaps, and policy",
    requiredLayers: ["capital", "observe", "understand", "attribute", "verify"],
    steps: [
      "Reading treasury state",
      "Observing funding gaps",
      "Loading allocation policies",
      "Weighting by community impact",
      "Building proposal",
    ],
    actions(ctx) {
      const actions: CapabilityAction[] = [
        {
          id: "simulate",
          label: "Compare allocation philosophies",
          prompt: "Compare Sustain Core vs Grow Ecosystem vs Balanced for this capital.",
          kind: "simulate",
        },
        {
          id: "adjust",
          label: "Adjust weights",
          prompt: "Show how shifting 10% from infrastructure to contributors changes outcomes.",
          kind: "simulate",
        },
      ];
      if (ctx.phase === "execute" && ctx.evidence.treasury.canSettleGlobally) {
        actions.push({
          id: "review-settlement",
          label: "Review settlement package",
          prompt: "Walk me through exactly what capital would move and who receives it.",
          kind: "execute",
        });
      } else if (!ctx.evidence.treasury.canSettleGlobally) {
        actions.push({
          id: "treasury",
          label: "Review treasury gap",
          prompt: "What treasury gap blocks executing this allocation?",
          kind: "explore",
        });
      }
      return actions.slice(0, 3);
    },
  },

  compare_ecosystems: {
    id: "compare_ecosystems",
    label: "Compare communities",
    purpose: "Side-by-side economic comparison from live community signals",
    requiredLayers: ["observe", "understand"],
    steps: [
      "Identifying communities to compare",
      "Pulling observation signals",
      "Comparing funding gaps",
      "Comparing contributor depth",
      "Synthesizing tradeoffs",
    ],
    actions(ctx) {
      const targets = ctx.compareTargets.join(" and ") || "these communities";
      return [
        {
          id: "allocate-compare",
          label: `Who deserves funding more — ${targets}?`,
          prompt: `Given the comparison, who deserves more capital between ${targets}?`,
          kind: "plan",
        },
        {
          id: "risk-compare",
          label: "Which carries more downstream risk?",
          prompt: `Which community in this comparison poses greater downstream dependency risk?`,
          kind: "explore",
        },
        {
          id: "save",
          label: "Save this comparison",
          prompt: `Save this ${targets} comparison to mission memory.`,
          kind: "remember",
        },
      ];
    },
  },

  assess_risk: {
    id: "assess_risk",
    label: "Assess community risk",
    purpose: "Dependency, bus-factor, and contributor risk from live observation",
    requiredLayers: ["observe", "understand", "attribute"],
    steps: [
      "Mapping dependencies",
      "Measuring bus factor",
      "Scanning contributor activity",
      "Estimating blast radius",
      "Ranking risks",
    ],
    actions(ctx) {
      const top = topFinding(ctx);
      return [
        {
          id: "blast",
          label: "Show blast radius",
          prompt: top ?
            `What breaks downstream if ${top.title} stops maintaining?`
          : "Map the largest downstream blast radius in observed communities.",
          kind: "explore",
        },
        {
          id: "rescue",
          label: "Model a rescue scenario",
          prompt: "Simulate a focused contributor rescue for the highest-risk community.",
          kind: "simulate",
        },
        {
          id: "fund-risk",
          label: "Fund risk reduction",
          prompt: "Build a capital plan that reduces the top dependency risk.",
          kind: "plan",
        },
      ];
    },
  },

  claim_value: {
    id: "claim_value",
    label: "Claim recognized value",
    purpose: "Surface claimable earnings from the authorization ledger",
    requiredLayers: ["attribute", "verify", "capital"],
    steps: [
      "Reading authorization ledger",
      "Matching your contributions",
      "Calculating claimable balance",
      "Checking settlement readiness",
      "Preparing claim summary",
    ],
    actions(ctx) {
      const claimable = ctx.evidence.ledger?.claimableUsd ?? 0;
      const actions: CapabilityAction[] = [];
      if (claimable > 0) {
        actions.push({
          id: "claim",
          label: `Claim $${Math.round(claimable).toLocaleString()}`,
          prompt: "Walk me through claiming my recognized value.",
          kind: "execute",
          href: "/claim",
        });
        actions.push({
          id: "breakdown",
          label: "Break down by community",
          prompt: "Break down my claimable value by community and contribution type.",
          kind: "explore",
        });
      } else {
        actions.push({
          id: "connect",
          label: "Link community identities",
          prompt: "Which community identities should I link so RESOLVE can recognize my contributions?",
          kind: "navigate",
          href: "/profile",
        });
      }
      actions.push({
        id: "history",
        label: "View recognition history",
        prompt: "Show my authorization and settlement history.",
        kind: "explore",
        href: "/capital",
      });
      return actions.slice(0, 3);
    },
  },

  research_ecosystem: {
    id: "research_ecosystem",
    label: "Research community",
    purpose: "Deep research report from observation, health, and concentration signals",
    requiredLayers: ["observe", "understand", "attribute"],
    steps: [
      "Observing community signals",
      "Gathering health indicators",
      "Analyzing funding posture",
      "Reviewing value concentration",
      "Composing research view",
    ],
    actions(ctx) {
      const scope = communityLabel(ctx);
      return [
        {
          id: "save",
          label: "Save to knowledge",
          prompt: `Save this ${scope} research to knowledge.`,
          kind: "remember",
        },
        {
          id: "monitor",
          label: "Start monitoring",
          prompt: `What should I watch for in ${scope} going forward?`,
          kind: "explore",
        },
        {
          id: "fund",
          label: "Who deserves funding here?",
          prompt: `Who deserves funding in ${scope} based on this research?`,
          kind: "plan",
        },
      ];
    },
  },

  explain_evidence: {
    id: "explain_evidence",
    label: "Explain evidence",
    purpose: "Explain causality behind a prior finding using live evidence",
    requiredLayers: ["observe", "understand", "capital", "verify"],
    steps: [
      "Loading prior context",
      "Tracing evidence chain",
      "Connecting economic signals",
      "Explaining causality",
      "Surfacing implications",
    ],
    actions(ctx) {
      const top = topFinding(ctx);
      return [
        {
          id: "consequence",
          label: "What breaks if we wait?",
          prompt: top ?
            `What economic consequences follow if we delay on ${top.title}?`
          : "What are the consequences of waiting on this?",
          kind: "explore",
        },
        {
          id: "peers",
          label: "Compare to peer communities",
          prompt: "How does this compare to similar communities at the same scale?",
          kind: "explore",
        },
        top ?
          {
            id: "plan",
            label: "Turn into capital plan",
            prompt: `Turn the analysis of ${top.title} into a funding plan.`,
            kind: "plan",
          }
        : {
            id: "next",
            label: "What should I do next?",
            prompt: "What is the highest-leverage next step?",
            kind: "plan",
          },
      ];
    },
  },

  execute_settlement: {
    id: "execute_settlement",
    label: "Execute settlement",
    purpose: "Prepare and review capital movement through treasury",
    requiredLayers: ["capital", "verify", "attribute"],
    steps: [
      "Reading treasury readiness",
      "Reviewing authorizations",
      "Validating obligations",
      "Preparing settlement package",
      "Awaiting approval",
    ],
    actions(ctx) {
      const actions: CapabilityAction[] = [
        {
          id: "walkthrough",
          label: "Walk through what moves",
          prompt: "Walk me through exactly what capital would move and who receives it.",
          kind: "execute",
        },
      ];
      if (ctx.evidence.treasury.canSettleGlobally && ctx.phase === "execute") {
        actions.push({
          id: "review-package",
          label: "Review settlement package",
          prompt: "Prepare the allocation for settlement review.",
          kind: "execute",
        });
      }
      actions.push({
        id: "after",
        label: "What happens after settlement?",
        prompt: "What happens across the community after this settlement completes?",
        kind: "explore",
      });
      return actions.slice(0, 3);
    },
  },

  general_inquiry: {
    id: "general_inquiry",
    label: "Community inquiry",
    purpose: "General evidence-backed reasoning across observed open communities",
    requiredLayers: ["observe", "understand", "capital", "attribute"],
    steps: [
      "Detecting community context",
      "Gathering live evidence",
      "Mapping relationships",
      "Reasoning over signals",
      "Preparing answer",
    ],
    actions(ctx) {
      if (ctx.findings.length > 0) {
        return CAPABILITY_REGISTRY.discover_value_leaks.actions(ctx);
      }
      return [
        {
          id: "discover",
          label: "Find value leaks",
          prompt: "Find value leaks across communities I'm observing.",
          kind: "explore",
        },
        {
          id: "fund",
          label: "Who deserves funding?",
          prompt: "Who deserves funding based on observed impact?",
          kind: "plan",
        },
      ];
    },
  },
};

export function getCapabilityDef(id: CapabilityId): CapabilityDef {
  return CAPABILITY_REGISTRY[id];
}
