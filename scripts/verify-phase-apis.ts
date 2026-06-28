/**
 * Smoke-test Phase 1–3 community APIs against a running server.
 * Usage: npx tsx scripts/verify-phase-apis.ts [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";

type Check = { name: string; method: string; path: string; expectStatus: number; expect?: (b: unknown) => boolean };

const checks: Check[] = [
  {
    name: "communities catalog",
    method: "GET",
    path: "/api/communities",
    expectStatus: 200,
    expect: (b) => Boolean((b as { ok?: boolean }).ok && (b as { communities?: unknown[] }).communities?.length),
  },
  {
    name: "community surface",
    method: "GET",
    path: "/api/communities/independent-music",
    expectStatus: 200,
    expect: (b) => Boolean((b as { community?: { impact?: unknown } }).community?.impact),
  },
  {
    name: "unknown community 404",
    method: "GET",
    path: "/api/communities/not-a-community",
    expectStatus: 404,
  },
  {
    name: "install requires auth",
    method: "POST",
    path: "/api/communities/independent-music/install",
    expectStatus: 401,
  },
  {
    name: "programs requires auth",
    method: "GET",
    path: "/api/communities/independent-music/programs",
    expectStatus: 401,
  },
  {
    name: "deploy requires auth",
    method: "POST",
    path: "/api/communities/independent-music/programs/x/deploy",
    expectStatus: 401,
  },
  {
    name: "rebalance requires auth",
    method: "POST",
    path: "/api/communities/independent-music/programs/x/rebalance",
    expectStatus: 401,
  },
  {
    name: "capital programs requires auth",
    method: "GET",
    path: "/api/capital/programs",
    expectStatus: 401,
  },
  {
    name: "navidrome sync status",
    method: "GET",
    path: "/api/connectors/navidrome/sync",
    expectStatus: 200,
    expect: (b) =>
      (b as { status?: { mode?: string } }).status?.mode === "bridge",
  },
  {
    name: "treasury snapshot",
    method: "GET",
    path: "/api/treasury/snapshot",
    expectStatus: 200,
    expect: (b) => Boolean((b as { snapshot?: { balanceUsd?: number } }).snapshot?.balanceUsd !== undefined),
  },
  {
    name: "health live fingerprint",
    method: "GET",
    path: "/api/health/live",
    expectStatus: 200,
    expect: (b) => {
      const body = b as { ok?: boolean; dataYear?: number };
      return Boolean(body.ok && body.dataYear === new Date().getUTCFullYear());
    },
  },
  {
    name: "health deploy fingerprint",
    method: "GET",
    path: "/api/health/deploy",
    expectStatus: 200,
    expect: (b) => Boolean((b as { ok?: boolean; phases?: { phase4?: boolean } }).ok && (b as { phases?: { phase4?: boolean } }).phases?.phase4),
  },
  {
    name: "profile earnings",
    method: "GET",
    path: "/api/profile/earnings",
    expectStatus: 200,
    expect: (b) => (b as { youEarnedUsd?: number }).youEarnedUsd !== undefined,
  },
  {
    name: "sensor status",
    method: "GET",
    path: "/api/communities/sensor-status",
    expectStatus: 200,
    expect: (b) => Boolean((b as { statuses?: unknown[] }).statuses?.length),
  },
  {
    name: "discover radar",
    method: "GET",
    path: "/api/discover/radar",
    expectStatus: 200,
    expect: (b) => {
      const updated = (b as { updatedAt?: string }).updatedAt;
      if (!updated) return false;
      return updated.startsWith(String(new Date().getUTCFullYear()));
    },
  },
  {
    name: "payments overview",
    method: "GET",
    path: "/api/payments/overview",
    expectStatus: 200,
    expect: (b) => Boolean((b as { treasury?: unknown }).treasury),
  },
];

async function run() {
  let failed = 0;
  for (const check of checks) {
    const res = await fetch(`${BASE}${check.path}`, { method: check.method });
    const body = res.headers.get("content-type")?.includes("json")
      ? await res.json()
      : null;
    const statusOk = res.status === check.expectStatus;
    const bodyOk = check.expect ? check.expect(body) : true;
    if (statusOk && bodyOk) {
      console.log(`OK: ${check.name}`);
    } else {
      failed++;
      console.error(
        `FAIL: ${check.name} — status ${res.status} (want ${check.expectStatus}) bodyOk=${bodyOk}`,
      );
    }
  }
  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log(`\nAll ${checks.length} API checks passed`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
