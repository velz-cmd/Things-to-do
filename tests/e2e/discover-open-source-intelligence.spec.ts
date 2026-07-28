import { expect, test } from "@playwright/test";

test.describe("Discover Funding Coverage Command Centre", () => {
  test.setTimeout(120_000);

  test("shows one focused funding workflow without legacy duplicate surfaces", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Accepted work|Economic attention/);
    const setup = page.getByRole("heading", { name: "Connect a repository" });
    const fundingCycle = page.getByRole("heading", { name: "Funding cycle" });
    await expect(setup.or(fundingCycle)).toBeVisible();
    if (await setup.count()) {
      await expect(page.getByRole("link", { name: "Connect GitHub" })).toBeVisible();
      await expect(page.getByLabel("Funding cycle stages")).toHaveCount(0);
      await expect(page.getByRole("tablist", { name: "Funding cycle details" })).toHaveCount(0);
    } else {
      await expect(page.getByRole("heading", { name: "Funding cycle" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Work requiring attention" })).toBeVisible();
      await expect(page.getByLabel("Funding cycle stages")).toBeVisible();
      await expect(page.getByRole("tablist", { name: "Work queue filters" })).toBeVisible();
      await expect(page.getByRole("tablist", { name: "Funding cycle details" })).toBeVisible();
    }
    await expect(page.getByText("Funding Coverage Matrix", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Live Signals", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Value Graph", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("tablist", { name: "Discover quick actions" })).toHaveCount(0);
    await expect(page.getByText("Earn from my work", { exact: true })).toHaveCount(0);
    expect(
      await page.locator(
        "[data-action-id='discover.capture_repository_snapshot'], [data-action-id='discover.select_repository'], [data-action-id='profile.connect_source']",
      ).count(),
    ).toBeGreaterThan(0);
  });

  test("contains the flagship surface at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const setup = page.getByRole("heading", { name: "Connect a repository" });
    const fundingCycle = page.getByRole("heading", { name: "Funding cycle" });
    await expect(setup.or(fundingCycle)).toBeVisible();
    if (await setup.count()) {
      await expect(page.getByRole("link", { name: "Connect GitHub" })).toBeVisible();
    } else {
      await expect(page.getByRole("heading", { name: "Funding cycle" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Work requiring attention" })).toBeVisible();
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("keeps secondary details collapsed until requested", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    const setup = page.getByRole("heading", { name: "Connect a repository" });
    const fundingCycle = page.getByRole("heading", { name: "Funding cycle" });
    await expect(setup.or(fundingCycle)).toBeVisible();
    if (await setup.count()) {
      await expect(page.getByRole("tablist", { name: "Funding cycle details" })).toHaveCount(0);
      return;
    }
    const pools = page.getByRole("tab", { name: /Pools/ });
    await expect(pools).toHaveAttribute("aria-selected", "false");
    await expect(page.getByText(/No persisted Pool is attached/)).toHaveCount(0);
    await pools.click();
    await expect(pools).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(/No persisted Pool is attached|available/).first()).toBeVisible();
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
