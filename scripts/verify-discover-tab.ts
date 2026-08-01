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
    html.includes("Discover economic activity"),
    "Discover has the Economic Action Network heading",
  );
  assert(html.includes("For You"), "Discover exposes For You");
  assert(html.includes("Explore"), "Discover exposes Explore");
  assert(html.includes("My Activity"), "Discover exposes My Activity");
  assert(html.includes("Outcomes"), "Discover exposes Outcomes");
  const explore = await fetch(`${BASE}/discover?view=explore`);
  const exploreHtml = await explore.text();
  assert(explore.ok, `Explore returns ${explore.status}`);
  assert(exploreHtml.includes("People"), "Explore exposes People");
  assert(exploreHtml.includes("Verified work"), "Explore exposes Verified work");
  assert(exploreHtml.includes("Communities"), "Explore exposes Communities");
  assert(exploreHtml.includes("Pools"), "Explore exposes Pools as a secondary filter");
  assert(exploreHtml.includes("Programs"), "Explore exposes Programs");
  assert(exploreHtml.includes("Funding gaps"), "Explore exposes Funding gaps");
  assert(exploreHtml.includes("Analyze an open-source project"), "Explore exposes public repository analysis");
  assert(!html.includes("Install GitHub App"), "Discover does not require a GitHub installation");
  assert(!html.includes("Connect GitHub"), "Discover does not require GitHub sign-in");
  assert(!html.includes("Accepted work that needs economic attention"), "Legacy repository-only heading is removed");
  assert(!html.includes("Complete Pool setup"), "Generic Pool setup actions are removed");
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
