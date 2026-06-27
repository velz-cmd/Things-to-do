import { KNOWN_COMMUNITIES } from "./detector";

export type CommunityRepoRef = { owner: string; repo: string; fullName: string };

/** Canonical GitHub signals for named community worlds — scanned live when users ask about them. */
const COMMUNITY_REPO_MAP: Record<string, Array<{ owner: string; repo: string }>> = {
  React: [
    { owner: "facebook", repo: "react" },
    { owner: "vercel", repo: "next.js" },
    { owner: "remix-run", repo: "remix" },
  ],
  Linux: [
    { owner: "torvalds", repo: "linux" },
    { owner: "gnome", repo: "gnome-shell" },
    { owner: "systemd", repo: "systemd" },
  ],
  Ethereum: [
    { owner: "ethereum", repo: "go-ethereum" },
    { owner: "ethereum", repo: "solidity" },
  ],
  Solana: [{ owner: "solana-labs", repo: "solana" }],
  Base: [{ owner: "base-org", repo: "node" }],
  "AI Infrastructure": [
    { owner: "langchain-ai", repo: "langchain" },
    { owner: "huggingface", repo: "transformers" },
    { owner: "pytorch", repo: "pytorch" },
  ],
  LangChain: [
    { owner: "langchain-ai", repo: "langchain" },
    { owner: "langchain-ai", repo: "langgraph" },
  ],
  "Linux Foundation": [
    { owner: "kubernetes", repo: "kubernetes" },
    { owner: "nodejs", repo: "node" },
  ],
  OpenStreetMap: [{ owner: "openstreetmap", repo: "iD" }],
  Wikipedia: [{ owner: "wikimedia", repo: "mediawiki" }],
};

function toRef(r: { owner: string; repo: string }): CommunityRepoRef {
  return { owner: r.owner, repo: r.repo, fullName: `${r.owner}/${r.repo}` };
}

/** Resolve live GitHub repos to observe for a community question or named world. */
export function resolveCommunityRepoSignals(input: {
  question: string;
  communityName?: string;
  attachedRepos?: CommunityRepoRef[];
}): CommunityRepoRef[] {
  const seen = new Set<string>();
  const out: CommunityRepoRef[] = [];

  const add = (owner: string, repo: string) => {
    const key = `${owner}/${repo}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(toRef({ owner, repo }));
  };

  for (const r of input.attachedRepos ?? []) {
    add(r.owner, r.repo);
  }

  const haystack = [input.question, input.communityName ?? ""].join(" ").toLowerCase();

  for (const world of KNOWN_COMMUNITIES) {
    const nameHit = input.communityName?.toLowerCase() === world.name.toLowerCase();
    const aliasHit = world.aliases.some((a) => haystack.includes(a.toLowerCase()));
    const tokenHit = haystack.split(/\s+/).includes(world.name.toLowerCase());
    if (!nameHit && !aliasHit && !tokenHit) continue;

    for (const r of COMMUNITY_REPO_MAP[world.name] ?? []) {
      add(r.owner, r.repo);
    }
  }

  if (input.communityName) {
    for (const r of COMMUNITY_REPO_MAP[input.communityName] ?? []) {
      add(r.owner, r.repo);
    }
  }

  return out.slice(0, 6);
}
