import type { DiscoverAction, DiscoverSearchResult } from "@/lib/discover/types";

/** Trim to 2–4 actionable chips per search result. */
export function trimSearchActions(actions: DiscoverAction[]): DiscoverAction[] {
  const seen = new Set<string>();
  const unique: DiscoverAction[] = [];
  for (const a of actions) {
    const key = `${a.kind}:${a.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(a);
  }
  if (unique.length <= 4) return unique;
  const priority: DiscoverAction["kind"][] = [
    "open",
    "fund",
    "install",
    "claim",
    "connect_sensor",
    "create_program",
    "analyze",
    "sponsor",
  ];
  const sorted = [...unique].sort(
    (a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind),
  );
  return sorted.slice(0, 4);
}

export function pickPrimaryAction(result: DiscoverSearchResult): DiscoverAction {
  const actions = result.actions;
  const fund = actions.find((a) => a.kind === "fund" || a.kind === "sponsor");
  if (fund) return fund;
  const install = actions.find((a) => a.kind === "install");
  if (install) return install;
  const claim = actions.find((a) => a.kind === "claim");
  if (claim) return claim;
  const open = actions.find((a) => a.kind === "open");
  if (open) return open;
  return actions[0];
}

export function parseOwnerRepo(raw: string): { owner: string; repo: string } | null {
  const q = raw.trim();
  const slash = q.indexOf("/");
  if (slash <= 0 || slash >= q.length - 1) return null;
  const owner = q.slice(0, slash).trim();
  const repo = q.slice(slash + 1).trim();
  if (!owner || !repo || owner.includes(" ") || repo.includes(" ")) return null;
  return { owner, repo };
}

export function parseMaintainerHandle(raw: string): string | null {
  const q = raw.trim();
  if (q.startsWith("@")) {
    const user = q.slice(1).trim();
    return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37})?$/.test(user) ? user : null;
  }
  const ghMatch = q.match(/^github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37})?)$/i);
  if (ghMatch) return ghMatch[1];
  return null;
}

export function isEvmWalletAddress(raw: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(raw.trim());
}

/** `fund react` → queue filter token */
export function parseFundQueueFilter(raw: string): string | null {
  const m = raw.trim().toLowerCase().match(/^fund\s+([a-z0-9-]+)$/);
  return m?.[1] ?? null;
}

export function artistEntityPath(mbid: string): string {
  return `/e/artist/${encodeURIComponent(mbid)}`;
}

export function maintainerEntityPath(username: string): string {
  return `/e/maintainer/github/${encodeURIComponent(username)}`;
}

export function walletEntityPath(address: string): string {
  return `/e/person/ethereum/${encodeURIComponent(address.toLowerCase())}`;
}

export function repoEntityPath(owner: string, repo: string): string {
  return `/e/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}
