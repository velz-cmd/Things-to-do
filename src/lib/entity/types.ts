import type { ConservationFlow, GiniResult, HIndexResult } from "@/lib/entity/economics";
import type { EntitySurfaceKind } from "@/lib/entity/paths";
import type { DiscoverGraphEdge, DiscoverGraphNode } from "@/lib/discover/radar";

export type EntityRelationship = {
  id: string;
  type: string;
  targetId: string;
  targetLabel: string;
  targetPath: string;
  weight: number;
  evidence: string;
};

export type EntityPerson = {
  id: string;
  label: string;
  role: string;
  path: string;
  evidence: string;
};

export type EntityTimelineItem = {
  id: string;
  title: string;
  detail: string;
  at: string;
  evidence: string;
};

export type EntityPayment = {
  id: string;
  amountUsd: number;
  status: string;
  contextLabel: string | null;
  connectorId: string;
  at: string;
  evidence: string;
};

export type EntityEvidenceItem = {
  id: string;
  label: string;
  detail: string;
  source: string;
};

export type EntitySurface = {
  ok: true;
  id: string;
  kind: EntitySurfaceKind;
  label: string;
  subtitle: string;
  path: string;
  live: boolean;
  emptyReason: string | null;
  overview: {
    typeLabel: string;
    sourceConnector?: string;
    attributes: Record<string, string | number>;
  };
  valueCreated: {
    totalUsd: number;
    eventCount: number;
    evidence: string;
  };
  fundingGap: {
    gapUsd: number;
    headline: string;
    evidence: string;
  };
  relationships: EntityRelationship[];
  people: EntityPerson[];
  timeline: EntityTimelineItem[];
  payments: EntityPayment[];
  evidence: EntityEvidenceItem[];
  economics: {
    conservation: ConservationFlow;
    gini: GiniResult;
    hIndex: HIndexResult | null;
  };
  graph: {
    nodes: DiscoverGraphNode[];
    edges: DiscoverGraphEdge[];
  };
  communitySlug?: string | null;
  updatedAt: string;
};
