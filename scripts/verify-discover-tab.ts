/**
 * Public Discover marketplace smoke.
 * Usage: npx tsx scripts/verify-discover-tab.ts [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";

let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) console.log(`OK: ${message}`);
  else {
    console.error(`FAIL: ${message}`);
    failed += 1;
  }
}

async function publicSurface() {
  const response = await fetch(`${BASE}/discover`);
  const html = await response.text();
  assert(response.ok, `Discover page returns ${response.status}`);
  assert(
    html.includes("Discover verified value"),
    "Discover has the verified funding network heading",
  );
  assert(html.includes("For You"), "Discover exposes For You");
  assert(html.includes("People"), "Discover exposes People");
  assert(html.includes("Verified Work"), "Discover exposes Verified Work");
  assert(html.includes("Pools"), "Discover exposes Pools");
  assert(html.includes("Programs"), "Discover exposes Programs");
  assert(html.includes("Outcomes"), "Discover exposes Outcomes");
  assert(html.includes("My Communities"), "Discover exposes My Communities");
  assert(html.includes("Fund a person"), "Discover exposes direct support");
  assert(html.includes("Back a Pool"), "Discover exposes Pool funding");
  assert(html.includes("Fund verified work"), "Discover exposes evidence-backed funding");
  assert(!html.includes("Install GitHub App"), "Discover does not require a GitHub installation");
  assert(!html.includes("Connect GitHub"), "Discover does not require GitHub sign-in");
  assert(!html.includes("Accepted work that needs economic attention"), "Legacy repository-only heading is removed");
}

async function publicApi() {
  const response = await fetch(`${BASE}/api/discover/opportunities?sort=newest`);
  const body = (await response.json()) as {
    items?: unknown[];
    failures?: Array<{ source?: string; requestId?: string }>;
    nextCursor?: string | null;
    total?: number;
  };
  assert([200, 503].includes(response.status), `Opportunity API returns a controlled status ${response.status}`);
  assert(Array.isArray(body.items), "Opportunity API returns an item list");
  assert(Array.isArray(body.failures), "Opportunity API returns source-isolated failures");
  assert(typeof body.total === "number", "Opportunity API returns a result count");
  assert(
    body.failures?.every((failure) => Boolean(failure.source && failure.requestId)) ?? false,
    "Every source failure has a source and request ID",
  );
}

async function protectedWrites() {
  const save = await fetch(`${BASE}/api/discover/saved`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ targetType: "opportunity", targetId: "test" }),
  });
  assert(save.status === 401, "Saving requires authentication");

  const apply = await fetch(`${BASE}/api/discover/applications`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      opportunityId: "test",
      proposal: "A complete test proposal that is long enough for validation.",
      evidenceLinks: [],
    }),
  });
  assert(apply.status === 401, "Applying requires authentication");

  const funding = await fetch(`${BASE}/api/discover/funding-review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ opportunityId: "test", mode: "outcome", amountUsd: 1 }),
  });
  assert(funding.status === 401, "Funding review requires authentication");
}

async function warmLoadPerformance() {
  await fetch(`${BASE}/discover`);
  const started = performance.now();
  const response = await fetch(`${BASE}/discover`);
  const duration = performance.now() - started;
  assert(response.ok, "Warm Discover page load succeeds");
  assert(duration < 4_000, `Warm Discover load is under 4 seconds (${Math.round(duration)}ms)`);
}

async function main() {
  console.log(`Discover marketplace verify → ${BASE}\n`);
  for (const check of [publicSurface, publicApi, protectedWrites, warmLoadPerformance]) {
    try {
      await check();
    } catch (error) {
      assert(false, error instanceof Error ? error.message : "Verification request failed");
    }
  }
  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll Discover marketplace checks passed");
}

void main();
