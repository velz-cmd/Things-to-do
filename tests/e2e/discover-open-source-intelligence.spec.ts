import { expect, test } from "@playwright/test";

test.describe("Discover Funding Coverage Command Centre", () => {
  test.setTimeout(120_000);

  test("keeps the compact Discover identity and exposes the funding coverage workflow", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Discover" })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Discover quick actions" })).toBeVisible();
    const coverage = page.getByRole("region", { name: "Funding Coverage Command Centre" });
    await expect(coverage.getByRole("heading", { name: "Funding Coverage Command Centre" })).toBeVisible();
    await expect(coverage.getByLabel("Funding Cycle Pulse")).toBeVisible();
    await expect(coverage.getByText("Funding Coverage Matrix", { exact: true })).toBeVisible();
    await expect(coverage.getByRole("heading", { name: "Work Ledger" })).toBeVisible();
    await expect(coverage.getByText("Pools", { exact: true }).first()).toBeVisible();
    await expect(coverage.getByText("Contributors", { exact: true }).first()).toBeVisible();
    await expect(coverage.getByText("Live Signals", { exact: true }).first()).toBeVisible();
    await expect(coverage.getByText("Confirmed Outcomes", { exact: true }).first()).toBeVisible();
    expect(
      await page.locator(
        "[data-action-id='discover.capture_repository_snapshot'], [data-action-id='discover.select_repository']",
      ).count(),
    ).toBeGreaterThan(0);
  });

  test("contains the flagship surface at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Discover" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Funding Coverage Command Centre" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Work Ledger" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("protects persisted snapshots and Mission creation from guests", async ({ request }) => {
    const snapshot = await request.post("/api/discover/oss-snapshots", {
      data: { repository: "navidrome/navidrome" },
    });
    expect(snapshot.status()).toBe(401);
    await expect(snapshot.json()).resolves.toMatchObject({ ok: false, code: "AUTH_REQUIRED" });

    const mission = await request.post("/api/discover/oss-missions", {
      data: {
        repository: "navidrome/navidrome",
        fingerprint: "a".repeat(64),
        objective: "Decide how accepted work should be funded.",
        evidenceIds: [],
        returnTo: "/discover?repo=navidrome/navidrome",
      },
    });
    expect(mission.status()).toBe(401);
    await expect(mission.json()).resolves.toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
  });
});
