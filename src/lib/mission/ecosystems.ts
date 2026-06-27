export type EcosystemKind =
  | "project"
  | "protocol"
  | "dao"
  | "foundation"
  | "community"
  | "organization";

export type Ecosystem = {
  id: string;
  name: string;
  kind: EcosystemKind;
  createdAt: string;
  /** Keywords used to scope reasoning when this ecosystem is active */
  keywords: string[];
  repos?: Array<{
    owner: string;
    repo: string;
    fullName: string;
    stars?: number;
    fundingGapUsd?: number;
    maintainerCount?: number;
  }>;
  connectors?: string[];
  missionCount?: number;
};

const STORAGE_KEY = "resolve-ecosystems";
const ACTIVE_KEY = "resolve-active-ecosystem";

const SEED: Omit<Ecosystem, "createdAt">[] = [
  { id: "react", name: "React", kind: "project", keywords: ["react", "next.js", "nextjs"] },
  { id: "ethereum", name: "Ethereum", kind: "protocol", keywords: ["ethereum", "eth", "evm"] },
  { id: "solana", name: "Solana", kind: "protocol", keywords: ["solana", "sol"] },
  { id: "base", name: "Base", kind: "protocol", keywords: ["base", "coinbase l2"] },
  { id: "langchain", name: "LangChain", kind: "project", keywords: ["langchain", "langgraph"] },
  {
    id: "linux-foundation",
    name: "Linux Foundation",
    kind: "foundation",
    keywords: ["linux foundation", "lf", "open source"],
  },
];

function seedEcosystems(): Ecosystem[] {
  const now = new Date().toISOString();
  return SEED.map((e) => ({ ...e, createdAt: now }));
}

export function loadEcosystems(): Ecosystem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedEcosystems();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as Ecosystem[];
    return Array.isArray(parsed) ? parsed : seedEcosystems();
  } catch {
    return seedEcosystems();
  }
}

export function saveEcosystems(ecosystems: Ecosystem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ecosystems));
}

export function addEcosystem(name: string, kind: EcosystemKind = "organization"): Ecosystem {
  const ecosystems = loadEcosystems();
  const id = `eco-${Date.now()}`;
  const entry: Ecosystem = {
    id,
    name,
    kind,
    createdAt: new Date().toISOString(),
    keywords: [name.toLowerCase()],
  };
  ecosystems.unshift(entry);
  saveEcosystems(ecosystems);
  return entry;
}

export function getActiveEcosystemId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

import { saveUserMemory } from "@/lib/resolve/workspace-memory";

export function setActiveEcosystemId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);

  void saveUserMemory({ activeEcosystemId: id }).catch(() => {
    /* non-fatal */
  });
}

export function getActiveEcosystem(): Ecosystem | undefined {
  const id = getActiveEcosystemId();
  if (!id) return undefined;
  return loadEcosystems().find((e) => e.id === id);
}

export function ecosystemContextPrompt(ecosystem: Ecosystem): string {
  return `The user is working inside the ${ecosystem.name} ecosystem. Interpret ambiguous questions (${ecosystem.keywords.join(", ")}) in that context unless they specify otherwise.`;
}
