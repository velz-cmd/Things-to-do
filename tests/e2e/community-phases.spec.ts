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

    const capital = await request.get("/api/capital/programs");
    expect(capital.status()).toBe(401);

    const deploy = await request.post(
      "/api/communities/independent-music/programs/test-id/deploy",
    );
    expect(deploy.status()).toBe(401);

    const rebalance = await request.post(
      "/api/communities/independent-music/programs/test-id/rebalance",
    );
    expect(rebalance.status()).toBe(401);
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

  test("payments overview returns treasury and ledger", async ({ request }) => {
    const res = await request.get("/api/payments/overview");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("treasury");
    expect(body).toHaveProperty("ledger");
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

  test("discover shows community directory", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("main").getByText("Community directory"),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByText("Install on Independent Music"),
    ).toBeVisible();
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
    await expect(page.getByText("Community programs")).toBeVisible();
  });
});
