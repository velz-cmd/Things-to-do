import { expect, test } from "@playwright/test";

test.describe("Discover verified funding network", () => {
  test.setTimeout(120_000);

  test("browses every public view without GitHub, wallet, or profile gates", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: "Discover verified value" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Connect GitHub|Install GitHub App/ })).toHaveCount(0);

    const views = [
      ["People", "people"],
      ["Verified Work", "work"],
      ["Pools", "pools"],
      ["Outcomes", "outcomes"],
      ["For You", "for_you"],
    ] as const;
    for (const [label, value] of views) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`view=${value}`));
      await expect(page.getByRole("heading", { level: 1, name: "Discover verified value" })).toBeVisible();
    }
    const communities = page.getByRole("link", { name: "My Communities", exact: true });
    await expect(communities).toHaveAttribute("href", "/communities");
  });

  test("keeps search and view state in the URL", async ({ page }) => {
    await page.goto("/discover?view=work", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    const search = page.getByPlaceholder(
      "Search a creator, contributor, community, Pool, or verified work",
    );
    await search.fill("typescript");
    await search.press("Enter");
    await expect(page).toHaveURL(/view=work/);
    await expect(page).toHaveURL(/q=typescript/, { timeout: 10_000 });
  });

  test("is usable at mobile width without page-level horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Communities", exact: true })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("opens a shareable opportunity detail when public work exists", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    const details = page.getByRole("link", { name: /View proof|Inspect details/ }).first();
    test.skip((await details.count()) === 0, "No public opportunity exists in this isolated database.");
    await details.click();
    await expect(page).toHaveURL(/\/opportunities\//);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Funding" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
  });

  test("hands a published Pool to Capital without losing Discover context", async ({ page }) => {
    await page.goto("/discover?view=pools", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    const backPool = page.getByRole("link", { name: "Add USDC to Pool" }).first();
    const hasPublishedPool = await backPool
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!hasPublishedPool, "No published Pool exists in this isolated database.");

    const href = await backPool.getAttribute("href");
    expect(href).toBeTruthy();
    const target = new URL(href!, "http://localhost");
    expect(target.pathname).toBe("/capital");
    expect(target.searchParams.get("intent")).toBe("back-pool");
    expect(target.searchParams.get("programId")).toBeTruthy();
    expect(target.searchParams.get("returnTo")).toContain("/discover?view=pools");

    await backPool.click();
    await expect(page).toHaveURL(/\/capital\?intent=back-pool/);
    await expect(page.getByRole("heading", { name: "Sign in to open Capital" })).toBeVisible();
  });

  test("keeps repository publication and Mission creation protected", async ({ request }) => {
    const snapshot = await request.post("/api/discover/oss-snapshots", {
      data: { repository: "navidrome/navidrome" },
    });
    expect(snapshot.status()).toBe(401);

    const mission = await request.post("/api/discover/oss-missions", {
      data: {
        repository: "navidrome/navidrome",
        fingerprint: "a".repeat(64),
        objective: "Decide how accepted work should be funded.",
        evidenceIds: [],
        returnTo: "/discover",
      },
    });
    expect(mission.status()).toBe(401);
  });
});
