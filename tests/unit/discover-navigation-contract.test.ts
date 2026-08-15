import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "..", "..");
const marketplacePath = join(
  repoRoot,
  "src/components/resolve/discover/marketplace/discover-marketplace.tsx",
);
const marketplaceSource = readFileSync(marketplacePath, "utf8");

const BANNED_LABELS = ["For You", "Explore", "People", "Outcomes"];
const REQUIRED_LABELS = [
  "Verified Work",
  "Open Requests",
  "Pools",
  "Agent Marketplace",
  "Activity",
];

describe("Discover navigation contract", () => {
  it("exposes exactly the five approved customer tabs, in order, with no banned legacy labels", () => {
    const viewsBlockMatch = marketplaceSource.match(
      /const views:[\s\S]*?\[([\s\S]*?)\];/,
    );
    expect(viewsBlockMatch).not.toBeNull();
    const viewsBlock = viewsBlockMatch![1];

    const labels = [...viewsBlock.matchAll(/label:\s*"([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(labels).toEqual(REQUIRED_LABELS);

    for (const banned of BANNED_LABELS) {
      // "Open Requests"/"Agent Marketplace" legitimately contain no banned
      // substrings, so a plain label-array check is safe here.
      expect(labels).not.toContain(banned);
    }
  });

  it("does not reintroduce dead legacy Discover components unreachable from the /discover route", () => {
    const src = join(repoRoot, "src");
    const discoverDir = join(src, "components", "resolve", "discover");

    function resolveImport(fromFile: string, spec: string): string | null {
      let base: string;
      if (spec.startsWith("@/")) base = join(src, spec.slice(2));
      else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
      else return null;
      const candidates = [
        `${base}.tsx`,
        `${base}.ts`,
        join(base, "index.tsx"),
        join(base, "index.ts"),
      ];
      return candidates.find((c) => existsSync(c)) ?? null;
    }

    function getImports(file: string): string[] {
      let text: string;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        return [];
      }
      const importRe =
        /from\s+["']([^"']+)["']|import\(["']([^"']+)["']\)/g;
      const specs: string[] = [];
      let m: RegExpExecArray | null;
      while ((m = importRe.exec(text))) specs.push((m[1] || m[2])!);
      return specs
        .map((s) => resolveImport(file, s))
        .filter((x): x is string => Boolean(x));
    }

    // Known-good entry points that legitimately import files under
    // src/components/resolve/discover/ from OUTSIDE the /discover route
    // (mission-control panels, communities, the standalone /opportunities
    // route, etc). Anything reachable only from these plus /discover is
    // allowed to exist; anything reachable from neither is dead code.
    const externalEntryPoints = [
      "src/app/(shell)/opportunities/[slug]/page.tsx",
      "src/components/resolve/mission-control/mission-blueprint-panel.tsx",
      "src/components/resolve/mission-control/mission-batch-allocation-panel.tsx",
      "src/components/resolve/mission-control/mission-communal-pool-panel.tsx",
      "src/components/resolve/mission-control/mission-live-panel.tsx",
      "src/components/resolve/communities/community-operations.tsx",
      "src/components/resolve/communities/community-graph-observatory.tsx",
      "src/components/resolve/communities/pool-checkpoint-panel.tsx",
      "src/components/resolve/signal-rails/signal-authorization-rails.tsx",
      "src/app/(shell)/program/page.tsx",
    ].map((p) => join(repoRoot, p));

    const entryPoints = [
      join(src, "app", "(shell)", "discover", "page.tsx"),
      join(src, "app", "(shell)", "discover", "loading.tsx"),
      ...externalEntryPoints,
    ];

    const visited = new Set<string>();
    const queue = [...entryPoints];
    while (queue.length) {
      const f = queue.pop()!;
      if (visited.has(f)) continue;
      visited.add(f);
      for (const dep of getImports(f)) queue.push(dep);
    }

    function walk(dir: string): string[] {
      const out: string[] = [];
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) out.push(...walk(p));
        else if (/\.(ts|tsx)$/.test(name)) out.push(p);
      }
      return out;
    }

    const all = walk(discoverDir);
    const dead = all.filter((f) => !visited.has(f));

    expect(
      dead.map((d) => d.replace(`${repoRoot}\\`, "").replace(`${repoRoot}/`, "")),
    ).toEqual([]);
  });
});
