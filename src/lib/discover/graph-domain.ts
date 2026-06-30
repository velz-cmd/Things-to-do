import type { DiscoverGraphEdge, DiscoverGraphNode } from "./radar";
import { domainForConnector } from "../workspace/domains";

export type GraphDomainFilter = "all" | "oss" | "music" | "research";

export const GRAPH_DOMAIN_CHIPS: { id: GraphDomainFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "oss", label: "OSS" },
  { id: "music", label: "Music" },
  { id: "research", label: "Research" },
];

const DOMAIN_TINT: Record<GraphDomainFilter, string> = {
  all: "#94a3b8",
  oss: "#fbbf24",
  music: "#34d399",
  research: "#a78bfa",
};

export type GraphNodeDomain = "oss" | "music" | "research" | "other";

export function graphDomainForConnector(connectorId: string): GraphNodeDomain {
  const d = domainForConnector(connectorId);
  if (d === "code") return "oss";
  if (d === "music") return "music";
  if (d === "research") return "research";
  return "other";
}

export function graphDomainForNode(node: DiscoverGraphNode): GraphNodeDomain {
  if (node.graphDomain) return node.graphDomain;
  if (node.type === "repository" || node.type === "person") return "oss";
  if (node.type === "creator") return "music";
  if (node.dataSource === "github") return "oss";
  if (node.dataSource === "openalex") return "research";
  if (node.dataSource === "musicbrainz") return "music";
  return "other";
}

export function tintForDomain(filter: GraphDomainFilter): string {
  return DOMAIN_TINT[filter];
}

export function nodeMatchesDomainFilter(
  node: DiscoverGraphNode,
  filter: GraphDomainFilter,
): boolean {
  if (filter === "all") return true;
  return graphDomainForNode(node) === filter;
}

export function filterGraphByDomain(
  nodes: DiscoverGraphNode[],
  edges: DiscoverGraphEdge[],
  filter: GraphDomainFilter,
): { nodes: DiscoverGraphNode[]; edges: DiscoverGraphEdge[] } {
  if (filter === "all") return { nodes, edges };
  const ids = new Set(nodes.filter((n) => nodeMatchesDomainFilter(n, filter)).map((n) => n.id));
  return {
    nodes: nodes.filter((n) => ids.has(n.id)),
    edges: edges.filter((e) => ids.has(e.from) && ids.has(e.to)),
  };
}

export function hasFundingGapEdge(nodeId: string, edges: DiscoverGraphEdge[]): boolean {
  return edges.some(
    (e) =>
      (e.from === nodeId || e.to === nodeId) &&
      (e.kind === "funding_gap" || e.kind === "funding_gap_edge"),
  );
}
