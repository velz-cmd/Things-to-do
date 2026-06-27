import type { CommunityKind } from "@/lib/mission/community";
import { saveUserMemory } from "@/lib/resolve/workspace-memory";

/** @deprecated alias — communities are worlds, not repos */
export type EcosystemKind = CommunityKind | "project" | "foundation" | "organization" | "community";

export type Ecosystem = {
  id: string;
  name: string;
  kind: EcosystemKind;
  createdAt: string;
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

/** @deprecated use Ecosystem — renaming to Community in UI */
export type Community = Ecosystem;

const STORAGE_KEY = "resolve-ecosystems";
const ACTIVE_KEY = "resolve-active-ecosystem";

/** Community worlds — not repositories. */
const SEED: Omit<Ecosystem, "createdAt">[] = [
  { id: "ai-infra", name: "AI Infrastructure", kind: "oss", keywords: ["ai", "llm", "langchain", "ml"] },
  { id: "react", name: "React", kind: "oss", keywords: ["react", "next.js", "nextjs"] },
  { id: "linux", name: "Linux", kind: "oss", keywords: ["linux", "kernel", "gnome", "fedora"] },
  { id: "ethereum", name: "Ethereum", kind: "protocol", keywords: ["ethereum", "eth", "evm"] },
  { id: "solana", name: "Solana", kind: "protocol", keywords: ["solana", "sol"] },
  { id: "independent-music", name: "Independent Music", kind: "music", keywords: ["music", "artist", "listenbrainz"] },
  { id: "open-education", name: "Open Education", kind: "education", keywords: ["education", "course", "teaching"] },
  { id: "digital-commons", name: "Digital Commons", kind: "general", keywords: ["commons", "creative commons"] },
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

export function addEcosystem(name: string, kind: EcosystemKind = "general"): Ecosystem {
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
  return `The user is working inside the ${ecosystem.name} community (${ecosystem.kind}). Interpret ambiguous questions (${ecosystem.keywords.join(", ")}) in that community context unless they specify otherwise.`;
}

export const loadCommunities = loadEcosystems;
export const addCommunity = addEcosystem;
export const getActiveCommunityId = getActiveEcosystemId;
export const setActiveCommunityId = setActiveEcosystemId;
export const getActiveCommunity = getActiveEcosystem;
export const communityContextPrompt = ecosystemContextPrompt;
