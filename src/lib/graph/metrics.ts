/**
 * Layer 4 — graph metrics on real adjacency (no decorative scores).
 * All inputs are explicit node ids + weighted edges from ledger / sensors.
 */

export type MetricEdge = {
  from: string;
  to: string;
  weight?: number;
};

export type GraphMetricResult = {
  id: string;
  label: string;
  degree: number;
  degreeCentrality: number;
  betweenness: number;
  pageRank: number;
  evidence: string;
};

export type FundingEntropyResult = {
  entropy: number;
  maxEntropy: number;
  concentrationPct: number;
  evidence: string;
};

function buildAdjacency(
  nodeIds: string[],
  edges: MetricEdge[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const id of nodeIds) adj.set(id, new Set());
  for (const e of edges) {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  }
  return adj;
}

/** Degree centrality k_i = number of neighbors / (n - 1) */
export function degreeCentralityScores(
  nodeIds: string[],
  edges: MetricEdge[],
): Map<string, number> {
  const n = nodeIds.length;
  if (n <= 1) return new Map(nodeIds.map((id) => [id, 0]));

  const adj = buildAdjacency(nodeIds, edges);
  const denom = n - 1;
  const out = new Map<string, number>();
  for (const id of nodeIds) {
    out.set(id, (adj.get(id)?.size ?? 0) / denom);
  }
  return out;
}

/** Brandes-style betweenness for unweighted small graphs (n ≤ 64). */
export function betweennessCentrality(
  nodeIds: string[],
  edges: MetricEdge[],
): Map<string, number> {
  const n = nodeIds.length;
  const scores = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  if (n <= 2) return scores;

  const adj = buildAdjacency(nodeIds, edges);
  const index = new Map(nodeIds.map((id, i) => [id, i]));

  for (const s of nodeIds) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
    const sigma = new Map<string, number>(nodeIds.map((id) => [id, 0]));
    const dist = new Map<string, number>(nodeIds.map((id) => [id, -1]));
    sigma.set(s, 1);
    dist.set(s, 0);
    const queue: string[] = [s];

    while (queue.length) {
      const v = queue.shift()!;
      stack.push(v);
      for (const w of adj.get(v) ?? []) {
        if ((dist.get(w) ?? -1) < 0) {
          queue.push(w);
          dist.set(w, (dist.get(v) ?? 0) + 1);
        }
        if ((dist.get(w) ?? 0) === (dist.get(v) ?? 0) + 1) {
          sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
          pred.get(w)!.push(v);
        }
      }
    }

    const delta = new Map<string, number>(nodeIds.map((id) => [id, 0]));
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred.get(w) ?? []) {
        const share = ((sigma.get(v) ?? 0) / (sigma.get(w) ?? 1)) * (1 + (delta.get(w) ?? 0));
        delta.set(v, (delta.get(v) ?? 0) + share);
      }
      if (w !== s) {
        scores.set(w, (scores.get(w) ?? 0) + (delta.get(w) ?? 0));
      }
    }
  }

  const norm = n > 2 ? 2 / ((n - 1) * (n - 2)) : 1;
  for (const id of nodeIds) {
    scores.set(id, (scores.get(id) ?? 0) * norm);
  }
  return scores;
}

/** PageRank with damping d — PR(i) = (1-d)/n + d * sum_j PR(j)/L(j) */
export function pageRankScores(
  nodeIds: string[],
  edges: MetricEdge[],
  damping = 0.85,
  iterations = 40,
): Map<string, number> {
  const n = nodeIds.length;
  const ranks = new Map<string, number>(nodeIds.map((id) => [id, 1 / Math.max(n, 1)]));

  if (n === 0) return ranks;

  const outWeight = new Map<string, number>();
  const outLinks = new Map<string, string[]>(nodeIds.map((id) => [id, []]));

  for (const e of edges) {
    const w = e.weight ?? 1;
    outLinks.get(e.from)?.push(e.to);
    outWeight.set(e.from, (outWeight.get(e.from) ?? 0) + w);
  }

  for (let iter = 0; iter < iterations; iter++) {
    const next = new Map<string, number>();
    const base = (1 - damping) / n;

    for (const id of nodeIds) {
      let sum = 0;
      for (const e of edges) {
        if (e.to !== id) continue;
        const ow = outWeight.get(e.from) ?? 0;
        if (ow <= 0) continue;
        sum += (ranks.get(e.from) ?? 0) * ((e.weight ?? 1) / ow);
      }
      next.set(id, base + damping * sum);
    }

    for (const id of nodeIds) ranks.set(id, next.get(id) ?? 0);
  }

  const total = [...ranks.values()].reduce((s, v) => s + v, 0);
  if (total > 0) {
    for (const id of nodeIds) ranks.set(id, (ranks.get(id) ?? 0) / total);
  }

  return ranks;
}

/** Shannon entropy H = -Σ p_i log2(p_i) on funding shares */
export function fundingEntropy(amounts: number[]): FundingEntropyResult {
  const total = amounts.reduce((s, a) => s + a, 0);
  if (total <= 0 || amounts.length === 0) {
    return {
      entropy: 0,
      maxEntropy: 0,
      concentrationPct: 0,
      evidence: "No funding distribution yet — entropy undefined until authorizations exist.",
    };
  }

  const probs = amounts.map((a) => a / total);
  const entropy = -probs.reduce((s, p) => (p > 0 ? s + p * Math.log2(p) : s), 0);
  const maxEntropy = Math.log2(amounts.length);
  const topShare = Math.max(...probs);
  const concentrationPct = Math.round(topShare * 1000) / 10;

  return {
    entropy: Math.round(entropy * 1000) / 1000,
    maxEntropy: Math.round(maxEntropy * 1000) / 1000,
    concentrationPct,
    evidence:
      concentrationPct >= 70
        ? `${concentrationPct}% of recognized value flows to one payee — high concentration risk.`
        : `Entropy ${entropy.toFixed(2)} bits across ${amounts.length} payees (max ${maxEntropy.toFixed(2)}).`,
  };
}

export function rankGraphNodes(input: {
  nodeIds: string[];
  labels: Map<string, string>;
  edges: MetricEdge[];
  topN?: number;
}): GraphMetricResult[] {
  const { nodeIds, labels, edges, topN = 8 } = input;
  if (!nodeIds.length) return [];

  const degree = degreeCentralityScores(nodeIds, edges);
  const between = betweennessCentrality(nodeIds, edges);
  const pr = pageRankScores(nodeIds, edges);

  const ranked = nodeIds
    .map((id) => {
      const d = degree.get(id) ?? 0;
      const b = between.get(id) ?? 0;
      const p = pr.get(id) ?? 0;
      const parts: string[] = [];
      if (d >= 0.25) parts.push(`degree ${(d * 100).toFixed(0)}%`);
      if (b >= 0.1) parts.push(`betweenness ${(b * 100).toFixed(0)}%`);
      if (p >= 1 / nodeIds.length * 2) parts.push(`PageRank ${(p * 100).toFixed(1)}%`);

      return {
        id,
        label: labels.get(id) ?? id,
        degree: Math.round(d * 1000) / 1000,
        degreeCentrality: Math.round(d * 1000) / 1000,
        betweenness: Math.round(b * 1000) / 1000,
        pageRank: Math.round(p * 1000) / 1000,
        evidence:
          parts.length > 0
            ? parts.join(" · ")
            : "Peripheral node in current authorization slice",
      };
    })
    .sort((a, b) => b.pageRank - a.pageRank || b.degree - a.degree)
    .slice(0, topN);

  return ranked;
}
