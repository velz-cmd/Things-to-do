/**
 * Discover tab smoke — search, install, fund, claim paths + surface hygiene.
 * Usage: npx tsx scripts/verify-discover-tab.ts [baseUrl]
 *
 * Run after `npm run build && npm run start` (or against a deployed preview).
 */
const BASE = process.argv[2] ?? "http://localhost:3000";

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    failed++;
  } else {
    console.log(`OK: ${msg}`);
  }
}

type Check = {
  name: string;
  method?: string;
  path: string;
  expectStatus: number;
  expect?: (body: unknown, headers: Headers) => boolean;
};

const checks: Check[] = [
  {
    name: "discover page HTML",
    path: "/discover",
    expectStatus: 200,
    expect: (_b, headers) => headers.get("content-type")?.includes("text/html") ?? false,
  },
  {
    name: "search returns actionable results",
    path: "/api/discover/search?q=react",
    expectStatus: 200,
    expect: (b) => {
      const body = b as { ok?: boolean; results?: unknown[]; topPrimaryAction?: unknown };
      return Boolean(body.ok && body.results?.length && body.topPrimaryAction);
    },
  },
  {
    name: "search fund queue filter",
    path: "/api/discover/search?q=fund%20react",
    expectStatus: 200,
    expect: (b) => (b as { queueFilter?: string }).queueFilter === "react",
  },
  {
    name: "install path requires auth",
    method: "POST",
    path: "/api/communities/navidrome/install",
    expectStatus: 401,
  },
  {
    name: "fund discover queue",
    path: "/api/capital/discover",
    expectStatus: 200,
    expect: (b) => Array.isArray((b as { opportunities?: unknown[] }).opportunities),
  },
  {
    name: "fund search resolves queue",
    path: "/api/discover/search?q=fund%20navidrome",
    expectStatus: 200,
    expect: (b) => {
      const body = b as { ok?: boolean; queueFilter?: string; results?: unknown[] };
      return Boolean(body.ok && body.queueFilter && body.results?.length);
    },
  },
  {
    name: "claim session requires auth",
    path: "/api/claim/session",
    expectStatus: 401,
  },
  {
    name: "radar feed shape",
    path: "/api/discover/radar-feed?limit=8",
    expectStatus: 200,
    expect: (b) => {
      const body = b as { ok?: boolean; gaps?: unknown[]; domainRadars?: unknown };
      return Boolean(body.ok && Array.isArray(body.gaps) && body.domainRadars);
    },
  },
  {
    name: "live events feed",
    path: "/api/events/live?limit=8&scope=network",
    expectStatus: 200,
    expect: (b) => Array.isArray((b as { events?: unknown[] }).events),
  },
  {
    name: "demo parcels quarantined",
    method: "POST",
    path: "/api/discover/parcels",
    expectStatus: 200,
    expect: (_b, headers) => headers.get("X-Deprecated") === "discover-parcels-demo",
  },
];

async function runCheck(c: Check) {
  const res = await fetch(`${BASE}${c.path}`, { method: c.method ?? "GET" });
  assert(res.status === c.expectStatus, `${c.name} → HTTP ${res.status}`);
  let body: unknown = null;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    body = await res.json();
  } else if (ct.includes("text/html")) {
    body = await res.text();
  }
  if (c.expect) {
    assert(c.expect(body, res.headers), `${c.name} → response shape`);
  }
}

async function hygieneChecks() {
  const html = await (await fetch(`${BASE}/discover`)).text();
  const forbiddenInDiscover = [
    "/mission/fund",
    'href="/missions"',
    "Open Mission",
    "Mission scope",
    "EcosystemBenefitsProgram",
    "MoneyFlowExplainer",
  ];
  for (const token of forbiddenInDiscover) {
    assert(!html.includes(token), `discover HTML excludes "${token}"`);
  }
  assert(html.includes("What do you want to do?"), "discover HTML includes job-first hero");
  assert(html.includes("Fund where it matters"), "discover HTML includes primary jobs");
  assert(!html.includes("Earn from my work"), "discover HTML excludes removed earn job card");
  assert(!html.includes("owner/repo"), "discover HTML excludes global search bar");
  assert(html.includes("Value graph"), "discover HTML includes value graph");
  assert(html.includes('href="/communities"'), "discover HTML links to Communities tab");
}

async function warmLoadPerf() {
  await fetch(`${BASE}/discover`);
  const t0 = performance.now();
  const res = await fetch(`${BASE}/discover`);
  const ms = performance.now() - t0;
  assert(res.ok, "warm discover page load succeeds");
  assert(ms < 3000, `warm discover load < 3s (${Math.round(ms)}ms)`);
}

async function main() {
  console.log(`Discover tab verify → ${BASE}\n`);

  for (const c of checks) {
    try {
      await runCheck(c);
    } catch (e) {
      assert(false, `${c.name} → ${e instanceof Error ? e.message : "request failed"}`);
    }
  }

  try {
    await hygieneChecks();
  } catch (e) {
    assert(false, `hygiene → ${e instanceof Error ? e.message : "failed"}`);
  }

  try {
    await warmLoadPerf();
  } catch (e) {
    assert(false, `perf → ${e instanceof Error ? e.message : "failed"}`);
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll Discover tab checks passed");
}

void main();
