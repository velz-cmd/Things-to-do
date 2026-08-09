import { expect, test } from "@playwright/test";

test.describe("Discover Economic Action Network", () => {
  test.setTimeout(120_000);

  test("switches through the four primary views without integration gates", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Discover" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Connect GitHub|Install GitHub App/ })).toHaveCount(0);

    const views = [
      ["Open Requests", "requests"],
      ["Pools", "pools"],
      ["Activity", "activity"],
      ["Verified Work", "verified_work"],
    ] as const;
    for (const [label, value] of views) {
      await page.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`view=${value}`));
      await expect(page.getByRole("heading", { level: 1, name: "Discover" })).toBeVisible();
    }
  });

  test("keeps Verified Work search and repository state in the URL", async ({ page }) => {
    await page.goto("/discover?view=verified_work&repository=octocat%2FHello-World", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await expect(page.getByRole("link", { name: "Verified Work", exact: true })).toHaveAttribute("aria-current", "page");
    const search = page.getByRole("searchbox", { name: "Search Discover" });
    await search.fill("typescript");
    await search.press("Enter");
    await expect(page).toHaveURL(/view=verified_work/);
    await expect(page).toHaveURL(/repository=octocat%2FHello-World/);
    await expect(page).toHaveURL(/q=typescript/, { timeout: 10_000 });
  });

  test("analyzes a public repository without requiring sign in", async ({ page }) => {
    await page.goto("/discover?view=verified_work&analyze=1", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    const repositoryInput = page.getByRole("textbox", { name: "Public GitHub repository" });
    const analyzeButton = page.getByRole("button", { name: "Analyse", exact: true });
    await expect(repositoryInput).toBeEnabled();
    await repositoryInput.fill("velz-cmd/repodiet-e2e-test");
    await analyzeButton.click();
    await expect(page.getByRole("heading", { name: "velz-cmd/repodiet-e2e-test" })).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText("Evidence saved to Discover", { exact: true })).toBeVisible();
  });

  test("is usable at mobile width without page-level horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Discover" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Activity", exact: true })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("keeps receipt claims behind the signed-in Activity ledger", async ({ page }) => {
    await page.goto("/discover?view=activity", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Discover" })).toBeVisible();
    const signedOut = page.getByRole("heading", { name: "Sign in to view your economic activity" });
    const isSignedOut = await signedOut.waitFor({ state: "visible", timeout: 2_000 }).then(() => true).catch(() => false);
    if (isSignedOut) {
      await expect(signedOut).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "Activity and receipts", exact: true })).toBeVisible();
      await expect(page.getByText(/No receipt-backed outcome is confirmed|Receipt archive/)).toBeVisible();
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
