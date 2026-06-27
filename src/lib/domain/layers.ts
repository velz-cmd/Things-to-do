/**
 * Frozen seven-layer build order.
 * Do not implement higher layers before lower layers are complete.
 *
 * @see docs/ARCHITECTURE.md
 */

export type ArchitectureLayerId =
  | "brain"
  | "intelligence"
  | "connectors"
  | "value_graph"
  | "capital_engine"
  | "workspace"
  | "design_system";

export type ArchitectureLayer = {
  id: ArchitectureLayerId;
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  name: string;
  question: string;
  status: "frozen" | "in_progress" | "not_started" | "complete" | "partial";
  modules: string[];
};

/** Authoritative layer map — update status as layers ship. */
export const ARCHITECTURE_LAYERS: ArchitectureLayer[] = [
  {
    id: "brain",
    number: 1,
    name: "The Brain",
    question: "What does RESOLVE know?",
    status: "in_progress",
    modules: ["lib/domain"],
  },
  {
    id: "intelligence",
    number: 2,
    name: "Intelligence Engine",
    question: "What should happen and why?",
    status: "not_started",
    modules: ["lib/intelligence (planned)", "api/workspace/ask (partial)"],
  },
  {
    id: "connectors",
    number: 3,
    name: "Connector Architecture",
    question: "What did sensors observe?",
    status: "not_started",
    modules: ["lib/connectors (partial — emits SettlementInputEvent, not Observation)"],
  },
  {
    id: "value_graph",
    number: 4,
    name: "Value Graph",
    question: "How is the world connected?",
    status: "not_started",
    modules: ["lib/graph (planned)"],
  },
  {
    id: "capital_engine",
    number: 5,
    name: "Capital Engine",
    question: "How does money move?",
    status: "partial",
    modules: ["lib/authorization", "lib/treasury", "lib/payment", "lib/settlement"],
  },
  {
    id: "workspace",
    number: 6,
    name: "Workspace",
    question: "How do humans see the engine?",
    status: "not_started",
    modules: ["components/resolve (do not extend until Layer 4 exists)"],
  },
  {
    id: "design_system",
    number: 7,
    name: "Design System",
    question: "How does it communicate?",
    status: "not_started",
    modules: ["globals.css", "components/resolve/ui"],
  },
];

export const CURRENT_LAYER: ArchitectureLayerId = "brain";

export function layerById(id: ArchitectureLayerId): ArchitectureLayer | undefined {
  return ARCHITECTURE_LAYERS.find((l) => l.id === id);
}

/** Layers that must not receive new feature work until CURRENT_LAYER advances. */
export function blockedLayersUntilBrainComplete(): ArchitectureLayerId[] {
  return ["workspace", "design_system"];
}
