import { test, expect } from "@playwright/test";

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

  test("discover shows community directory", async ({ page, request }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded" });
    const communities = page.locator("#communities");
    await expect(communities.getByText("Community directory")).toBeVisible();
    await expect(communities.getByText("Install on Independent Music")).toBeVisible();

    const statusRes = await request.get("/api/communities/sensor-status");
    const body = await statusRes.json();
    const react = (body.statuses ?? []).find((s: { slug: string }) => s.slug === "react");
    const reactInstall = communities.getByText("Install on React");
    if (react?.sensorGated && !react?.sensorLive) {
      await expect(reactInstall).toHaveCount(0);
    }
  });

  test("discover shows value radar surfaces", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Where is value being created/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("main").getByText("Live value feed")).toBeVisible();
    await expect(page.getByRole("main").getByText("Value command center")).toBeVisible();
    await expect(page.getByRole("main").getByText("Trending value gaps")).toBeVisible();
    await expect(page.getByRole("main").getByText("Fulfillment queue")).toBeVisible();
  });

  test("network redirects to discover", async ({ page }) => {
    await page.goto("/network", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/discover/);
  });

  test("capital page loads with programs section", async ({ page }) => {
    await page.goto("/capital", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { level: 1, name: "Where should money move?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Programs" }).click();
    await expect(
      page.getByRole("heading", { name: "Fulfill a community program" }),
    ).toBeVisible();
  });

  test("communities hub loads and nav highlights Communities", async ({ page }) => {
    await page.goto("/communities", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Communities" })).toBeVisible();
    await expect(page.getByText("Your operating rooms")).toBeVisible();
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
