import { expect, test } from "@playwright/test";

test.describe("Discover Economic Action Network", () => {
  test.setTimeout(120_000);

  test("switches through the four primary views without integration gates", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Discover economic activity" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Connect GitHub|Install GitHub App/ })).toHaveCount(0);

    const views = [
      ["Explore", "explore"],
      ["My Activity", "activity"],
      ["Outcomes", "outcomes"],
      ["For You", "for_you"],
    ] as const;
    for (const [label, value] of views) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`view=${value}`));
      await expect(page.getByRole("heading", { level: 1, name: "Discover economic activity" })).toBeVisible();
    }
  });

  test("keeps Explore intent and search state in the URL", async ({ page }) => {
    await page.goto("/discover?view=explore&kind=work&repository=octocat%2FHello-World", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await expect(page.getByRole("link", { name: "Verified work", exact: true })).toHaveAttribute("aria-current", "page");
    const search = page.getByRole("searchbox", { name: "Search Discover" });
    await search.fill("typescript");
    await search.press("Enter");
    await expect(page).toHaveURL(/view=explore/);
    await expect(page).toHaveURL(/kind=work/);
    await expect(page).toHaveURL(/repository=octocat%2FHello-World/);
    await expect(page).toHaveURL(/q=typescript/, { timeout: 10_000 });
  });

  test("analyzes a public repository without requiring sign in", async ({ page }) => {
    await page.goto("/discover?view=explore&analyze=1", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.getByRole("textbox", { name: "Public GitHub repository" }).fill("octocat/Hello-World");
    await page.getByRole("button", { name: "Analyze real activity" }).click();
    await expect(page.getByRole("heading", { name: "octocat/Hello-World" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Sign in to persist evidence")).toBeVisible();
  });

  test("is usable at mobile width without page-level horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Discover economic activity" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Activity", exact: true })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("shows factual empty outcome copy when no receipt exists", async ({ page }) => {
    await page.goto("/discover?view=outcomes", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Discover economic activity" })).toBeVisible();
    const empty = page.getByRole("heading", { name: "No confirmed outcome receipt yet" });
    const hasEmptyState = await empty.waitFor({ state: "visible", timeout: 2_000 }).then(() => true).catch(() => false);
    if (hasEmptyState) {
      await expect(empty).toBeVisible();
      await expect(empty.locator("..").getByText(/only after a chain transaction confirms/)).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "Confirmed settlements and receipts" })).toBeVisible();
    }
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
