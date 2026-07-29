import { expect, test } from "@playwright/test";

test.describe("Discover public marketplace", () => {
  test.setTimeout(120_000);

  test("browses public sections without GitHub, wallet, or profile gates", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Discover work, people and communities worth backing",
      }),
    ).toBeVisible();
    await expect(page.getByText("Public browsing, no wallet or GitHub connection required")).toBeVisible();
    await expect(page.getByRole("link", { name: /Connect GitHub|Install GitHub App/ })).toHaveCount(0);
    await expect(page.getByRole("tablist", { name: "Discover sections" })).toBeVisible();

    await page.getByRole("tab", { name: "Communities" }).click();
    await expect(page).toHaveURL(/view=communities/);
    await expect(page.getByRole("heading", { name: "Independent Music" })).toBeVisible();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("tab", { name: "Communities" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByRole("tab", { name: "Funding Pools" }).click();
    await expect(page).toHaveURL(/view=pools/);
  });

  test("keeps search and filter state in the URL", async ({ page }) => {
    await page.goto("/discover?view=opportunities", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    const search = page.getByPlaceholder(
      "Search work, skills, communities, creators or repositories",
    );
    await search.fill("typescript");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=typescript/, { timeout: 10_000 });
    await page.getByLabel("Opportunity type").selectOption("grant");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/type=grant/);
    await page.goBack();
    await expect(page).toHaveURL(/q=typescript/);
  });

  test("is usable at mobile width without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const filters = page.getByRole("button", { name: /filters/i });
    await expect(filters).toBeVisible();
    await expect(filters).toBeEnabled({ timeout: 60_000 });
    await filters.click();
    await expect(page.getByRole("dialog", { name: "Filter opportunities" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Filter opportunities" })).toBeHidden();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("opens a shareable opportunity detail when public work exists", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    const details = page.getByRole("link", { name: "View details" }).first();
    test.skip((await details.count()) === 0, "No public opportunity exists in this isolated database.");
    await details.click();
    await expect(page).toHaveURL(/\/opportunities\//);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Funding" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
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
