import { test, expect } from "@playwright/test";
import { openDiscoverWorkspaceLane, openFundingBoard } from "./helpers/discover-fund";

/** Phase 1–3 API and surface smoke tests */
test.describe("Community phases — APIs", () => {
  test("GET /api/communities returns catalog", async ({ request }) => {
    const res = await request.get("/api/communities");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.communities?.length).toBeGreaterThanOrEqual(2);
    const slugs = body.communities.map((c: { slug: string }) => c.slug);
    expect(slugs).toContain("independent-music");
    expect(slugs).toContain("navidrome");
    const navidrome = body.communities.find((c: { slug: string }) => c.slug === "navidrome");
    expect(navidrome.vitals).toHaveProperty("healthLabel");
    expect(navidrome.vitals).toHaveProperty("fundingLabel");
    expect(navidrome.vitals).toHaveProperty("openWorkCount");
    expect(navidrome.vitals).toHaveProperty("programCount");
    expect(navidrome.vitals).toHaveProperty("topBuilders");
    expect(navidrome.vitals).toHaveProperty("sensor");
    expect(navidrome.vitals).toHaveProperty("observeNarrative");
  });

  test("GET /api/communities/[slug] returns surface without auth", async ({ request }) => {
    const res = await request.get("/api/communities/independent-music");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.community.name).toBe("Independent Music");
    expect(body.community).toHaveProperty("impact");
    expect(body.community).toHaveProperty("observatory");
    expect(body.community).toHaveProperty("economicMemory");
    expect(body.community).toHaveProperty("deployReadiness");
  });

  test("GET /api/communities/[slug]?lite=1 returns lite surface", async ({ request }) => {
    const res = await request.get("/api/communities/independent-music?lite=1");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.community.name).toBe("Independent Music");
    expect(body.community.observatory).toEqual([]);
    expect(body.community.economicMemory).toEqual([]);
    expect(body.community.timeline).toEqual([]);
    expect(body.community.health.treasuryUsd).toBe(body.community.impact.programBudgetUsd);
  });

  test("protected community routes return 401 without auth", async ({ request }) => {
    const install = await request.post("/api/communities/independent-music/install");
    expect(install.status()).toBe(401);

    const programs = await request.get("/api/communities/independent-music/programs");
    expect(programs.status()).toBe(401);

    const deploy = await request.post(
      "/api/communities/independent-music/programs/test-id/deploy",
    );
    expect(deploy.status()).toBe(401);

    const rebalance = await request.post(
      "/api/communities/independent-music/programs/test-id/rebalance",
    );
    expect(rebalance.status()).toBe(401);
  });

  test("GET /api/capital/programs returns public catalog without auth", async ({ request }) => {
    const res = await request.get("/api/capital/programs");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.public).toBe(true);
    expect(Array.isArray(body.programs)).toBe(true);
  });

  test("navidrome sync GET returns bridge status", async ({ request }) => {
    const res = await request.get("/api/connectors/navidrome/sync");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toHaveProperty("mode", "bridge");
    expect(body.status).toHaveProperty("syncEndpoint");
  });

  test("treasury snapshot returns real shape", async ({ request }) => {
    const res = await request.get("/api/treasury/snapshot");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.snapshot).toHaveProperty("balanceUsd");
    expect(body.snapshot).toHaveProperty("availableUsd");
  });

  test("payments overview requires sign-in", async ({ request }) => {
    const res = await request.get("/api/payments/overview");
    expect(res.status()).toBe(401);
  });

  test("discover search returns repo and maintainer shapes", async ({ request }) => {
    const repoRes = await request.get("/api/discover/search?q=navidrome%2Fnavidrome");
    expect(repoRes.ok()).toBeTruthy();
    const repoBody = await repoRes.json();
    expect(repoBody.ok).toBe(true);
    expect(repoBody.results.length).toBeGreaterThan(0);
    const repo = repoBody.results.find((r: { kind: string }) => r.kind === "repository");
    expect(repo?.entityPath).toContain("/e/repo/navidrome/navidrome");
    expect(repo?.communitySlug).toBe("navidrome");
    expect(repo?.actions?.length).toBeGreaterThanOrEqual(2);
    expect(repoBody.topPrimaryAction).toBeTruthy();

    const userRes = await request.get("/api/discover/search?q=%40octocat");
    const userBody = await userRes.json();
    const maintainer = userBody.results.find((r: { label: string }) => r.label === "@octocat");
    expect(maintainer?.entityPath).toBe("/e/maintainer/github/octocat");

    const fundRes = await request.get("/api/discover/search?q=fund%20react");
    const fundBody = await fundRes.json();
    expect(fundBody.queueFilter).toBe("react");
  });

  test("live events API returns labeled feed shape", async ({ request }) => {
    const res = await request.get("/api/events/live?limit=12&scope=network");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("events");
    expect(Array.isArray(body.events)).toBe(true);
    expect(body).toHaveProperty("updatedAt");
  });

  test("discover radar-feed API returns unified feed shape", async ({ request }) => {
    const res = await request.get("/api/discover/radar-feed?limit=12");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("gaps");
    expect(body).toHaveProperty("radars");
    expect(body.radars).toHaveProperty("oss");
    expect(body.radars).toHaveProperty("music");
    expect(body.radars).toHaveProperty("dao");
    expect(body).toHaveProperty("domainRadars");
    expect(body.domainRadars.oss).toHaveProperty("toolbar");
    expect(body.domainRadars.oss).toHaveProperty("hasLiveData");
    expect(body.domainRadars.music).toHaveProperty("cards");
    expect(body.domainRadars.dao).toHaveProperty("emptyState");
    expect(Array.isArray(body.domainRadars.oss.toolbar)).toBe(true);
    if (body.domainRadars.oss.toolbar.length > 0) {
      expect(body.domainRadars.oss.toolbar[0]).toHaveProperty("kind");
      expect(body.domainRadars.oss.toolbar[0]).toHaveProperty("label");
    }
    expect(body).toHaveProperty("emptyStates");
    expect(body).toHaveProperty("intelligence");
    expect(body).toHaveProperty("realSignalCount");
    expect(body).toHaveProperty("updatedAt");
    for (const gap of body.gaps as { proofSource?: string; dataSource?: string }[]) {
      expect(gap.proofSource).toBeTruthy();
      expect(gap.dataSource).toBeTruthy();
    }
  });

  test("discover radar API returns real shape", async ({ request }) => {
    const res = await request.get("/api/discover/radar");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("activity");
    expect(body).toHaveProperty("graph");
    expect(body.graph).toHaveProperty("nodes");
    expect(body.graph).toHaveProperty("edges");
    expect(body.graph.nodes.length).toBeLessThanOrEqual(24);
    expect(body).toHaveProperty("live");
    expect(body).toHaveProperty("hasCatalogPreview");
    expect(body).toHaveProperty("metrics");
    expect(body.metrics).toHaveProperty("fundingEntropy");
    expect(body.metrics.fundingEntropy).toHaveProperty("evidence");
  });

  test("entity API returns surface for repository", async ({ request }) => {
    const res = await request.get("/api/entity/repo/vercel/next.js");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBe("repo:vercel/next.js");
    expect(body.kind).toBe("repository");
    expect(body).toHaveProperty("overview");
    expect(body).toHaveProperty("valueCreated");
    expect(body).toHaveProperty("fundingGap");
    expect(body).toHaveProperty("relationships");
    expect(body).toHaveProperty("people");
    expect(body).toHaveProperty("timeline");
    expect(body).toHaveProperty("payments");
    expect(body).toHaveProperty("evidence");
    expect(body.economics).toHaveProperty("conservation");
    expect(body.economics).toHaveProperty("gini");
    expect(body.economics.conservation).toHaveProperty("evidence");
  });

  test("entity API returns surface for community", async ({ request }) => {
    const res = await request.get("/api/entity/community/independent-music");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.kind).toBe("community");
    expect(body.label).toBe("Independent Music");
  });

  test("entity API 400 for invalid path", async ({ request }) => {
    const res = await request.get("/api/entity/invalid");
    expect(res.status()).toBe(400);
  });

  test("sensor status API returns gated communities", async ({ request }) => {
    const res = await request.get("/api/communities/sensor-status");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.statuses?.length).toBeGreaterThanOrEqual(5);
    const react = body.statuses.find((s: { slug: string }) => s.slug === "react");
    expect(react).toHaveProperty("sensorGated", true);
    expect(react).toHaveProperty("sensorLive");
  });

  test("github sensor sync GET returns pipeline info", async ({ request }) => {
    const res = await request.get("/api/connectors/github/sync");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.programs).toContain("docs-bounty (RFB #3)");
    expect(body.communities).toContain("react");
  });

  test("openalex sensor sync GET returns pipeline info", async ({ request }) => {
    const res = await request.get("/api/connectors/openalex/sync");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.program).toContain("RFB #2");
  });

  test("GET /api/agent/services returns micro-services catalog", async ({ request }) => {
    const res = await request.get("/api/agent/services");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.tagline).toContain("Agents buy signals");
    expect(body.platformLoop?.sampleAgentInvoke).toHaveProperty("platformFeeUsd");
    expect(body.services?.length).toBeGreaterThanOrEqual(5);
    expect(body.feePath).toHaveProperty("platformFeeBps");
    const sentiment = body.services.find((s: { id: string }) => s.id === "sentiment-per-request");
    expect(sentiment?.priceUsd).toBe(0.001);
    const security = body.services.find((s: { id: string }) => s.id === "security-signal");
    expect(security?.priceUsd).toBe(0.1);
  });

  test("GET /api/earn/discover returns eligibility for anonymous", async ({ request }) => {
    const res = await request.get("/api/earn/discover");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.signedIn).toBe(false);
    expect(body.eligibility?.length).toBeGreaterThanOrEqual(4);
    const oss = body.eligibility.find((r: { id: string }) => r.id === "oss");
    expect(oss.threshold).toContain("5+");
  });

  test("POST /api/agent/invoke requires sign-in", async ({ request }) => {
    const res = await request.post("/api/agent/invoke", {
      data: {
        serviceId: "docs-review",
        prompt: "Run intel on React maintainers",
        maxSpendUsd: 0.05,
      },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Sign in");
  });

  test("POST /api/communities/react/automations/simulate returns projection", async ({ request }) => {
    const res = await request.post("/api/communities/react/automations/simulate", {
      data: {
        triggerEvent: "docs_merge",
        authorizeUsd: 25,
        notifyChannel: "email",
        sampleEvents: 4,
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.simulation.projectedAuthorizeUsd).toBe(100);
    expect(body.simulation.eventType).toBe("contribution.merge");
  });

  test("GET /api/communities/react/automations requires sign-in", async ({ request }) => {
    const res = await request.get("/api/communities/react/automations");
    expect(res.status()).toBe(401);
  });

  test("GET /api/economy/infrastructure exposes platform revenue loop", async ({ request }) => {
    const res = await request.get("/api/economy/infrastructure");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.summary?.platformRevenue?.tagline).toContain("Agents buy signals");
    expect(body.summary?.platformRevenue?.loop?.sampleAgentInvoke).toHaveProperty("platformFeeUsd");
    const agentStream = body.platformRevenue?.find(
      (s: { id: string }) => s.id === "x402_agent",
    );
    expect(agentStream?.shipped).toBe(true);
  });

  test("GET /api/capital/discover returns board with opportunity scores", async ({ request }) => {
    const res = await request.get("/api/capital/discover");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.board?.length).toBeGreaterThan(0);
    const programs = body.board.filter((b: { boardKind?: string }) => b.boardKind === "program");
    const withScores = body.board.filter(
      (b: { opportunityScorecard?: { chips?: unknown[] } }) => b.opportunityScorecard?.chips?.length,
    );
    if (programs.length > 0) {
      expect(withScores.length).toBeGreaterThan(0);
      const card = withScores[0].opportunityScorecard;
      expect(card.chips.length).toBe(6);
      expect(card.composite).toBeGreaterThan(0);
    } else {
      const communities = body.board.filter((b: { boardKind?: string }) => b.boardKind === "community");
      expect(communities.length).toBeGreaterThan(0);
    }
  });
});

test.describe("Community phases — surfaces", () => {
  test("community pages render for catalog slugs", async ({ page }) => {
    test.setTimeout(90_000);

    for (const slug of ["independent-music", "navidrome"]) {
      await page.goto(`/communities/${slug}`, { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible({ timeout: 30_000 });
    }
  });

  test("discover funder role shows sortable opportunity board", async ({ page }) => {
    test.setTimeout(120_000);

    await openFundingBoard(page);

    const board = page.locator("#opportunities");
    const sortOrSetup = board
      .getByText("Sort by")
      .or(board.getByRole("button", { name: /Fulfill pool/i }))
      .or(board.getByText(/Set up React|Set up Navidrome|Explore music program|Connect GitHub/i));
    await expect(sortOrSetup.first()).toBeVisible({ timeout: 30_000 });
    const hasSort = await board.getByText("Sort by").isVisible().catch(() => false);
    if (hasSort) {
      await expect(board.getByRole("button", { name: "Reward" })).toBeVisible();
    }
  });

  test("discover founder role opens opportunity board", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("tab", { name: /Run a program/i }).click();
    const nav = page.getByRole("navigation", { name: "Discover workspace" });
    await nav.getByRole("button", { name: "Ready to Fund" }).click();
    await expect(page.locator("#opportunities")).toBeVisible({ timeout: 60_000 });
  });

  test("mission runs agent signal from chat prompt", async ({ page }) => {
    await page.goto("/mission", { waitUntil: "domcontentloaded" });
    await page
      .getByPlaceholder(/Run intel, describe a funding objective/i)
      .fill("Run intel on React maintainers — docs gaps and contributor health");
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("What you get", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Run agent/i })).toBeVisible();
    await expect(page.getByText("Suggested service")).toBeVisible();
  });

  test("discover community role opens unpaid value with operational rows", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await openDiscoverWorkspaceLane(page, "Unpaid Value");

    await expect(page.getByRole("heading", { name: "Unpaid Value" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Jellyfin|Navidrome|React|payout program|watch events/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /Set up|Connect|Scan/i }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Fulfill pool|Connect source|View proof/i }).first(),
    ).toBeVisible();
  });

  test("communities hub shows install cards and vitals", async ({ page, request }) => {
    test.setTimeout(90_000);

    await page.goto("/communities", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Communities" })).toBeVisible();
    await page.waitForResponse(
      (res) => res.url().includes("/api/communities") && res.ok(),
      { timeout: 45_000 },
    );

    await expect(page.getByRole("heading", { name: "Your communities" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: "Add a community" })).toBeVisible({
      timeout: 30_000,
    });

    const connectCommunity = page.getByRole("button", { name: /Connect community|Install on/i });
    await expect(connectCommunity.first()).toBeVisible({ timeout: 30_000 });

    const operate = page.getByRole("link", { name: "Operate" });
    if ((await operate.count()) > 0) {
      await expect(operate.first()).toBeVisible();
    }

    const health = page.getByText("Health");
    if ((await health.count()) > 0) {
      await expect(health.first()).toBeVisible();
      await expect(page.getByText("Funding").first()).toBeVisible();
      await expect(page.getByText("Open work").first()).toBeVisible();
    }

    const statusRes = await request.get("/api/communities/sensor-status");
    const body = await statusRes.json();
    const react = (body.statuses ?? []).find((s: { slug: string }) => s.slug === "react");
    const reactInstall = page.getByRole("button", { name: "Install on React" });
    if (react?.sensorGated && !react?.sensorLive) {
      await expect(reactInstall).toHaveCount(0);
    }
  });

  test("discover shows value graph and workspace lanes", async ({ page }) => {
    test.setTimeout(90_000);

    const radarReady = page.waitForResponse(
      (res) => res.url().includes("/api/discover/radar") && res.ok(),
      { timeout: 45_000 },
    );
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await radarReady;

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /What value do you want to unlock/i,
      }),
    ).toBeVisible();

    const valueGraph = page.getByRole("heading", { name: "Value graph" });
    await valueGraph.scrollIntoViewIfNeeded();

    await expect(valueGraph).toBeVisible();
    await expect(
      page
        .getByRole("main")
        .getByText(/horizontal cards|Pick a node below|Map view shows how value connects|Ledger graph is empty/i)
        .first(),
    ).toBeVisible();
    const svg = page.locator('svg[aria-label="Value bubblemap"]');
    const emptyLedger = page.getByText(/Ledger graph is empty|No ledger nodes yet/i);
    await expect(svg.or(emptyLedger).first()).toBeVisible({ timeout: 30_000 });

    await openDiscoverWorkspaceLane(page, "Unpaid Value");
    await expect(page.getByRole("heading", { name: "Unpaid Value" })).toBeVisible();

    await openDiscoverWorkspaceLane(page, "Ready to Fund");
    await expect(page.getByRole("heading", { name: "Ready to Fund" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Research" }).first()).toBeVisible();
  });

  test("network redirects to discover", async ({ page }) => {
    await page.goto("/network", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/discover/);
  });

  test("capital page exposes the authenticated operations entry", async ({ page }) => {
    await page.goto("/capital", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Sign in to open Capital" }),
    ).toBeVisible();
  });

  test("communities hub loads and nav highlights Communities", async ({ page }) => {
    await page.goto("/communities", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Communities" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your communities" })).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Communities" }).first(),
    ).toBeVisible();
  });

  test("claim page stays on claim route", async ({ page }) => {
    await page.goto("/claim", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/claim/);
    await expect(page.getByRole("heading", { level: 1, name: "Claim earnings" })).toBeVisible();
  });

  test("entity page loads for repository", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/e/repo/vercel/next.js", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Conservation flow").first()).toBeVisible();
    await expect(page.getByText("Gini coefficient").first()).toBeVisible();
  });

  test("entity page loads for community", async ({ page }) => {
    await page.goto("/e/community/independent-music", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Independent Music" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
