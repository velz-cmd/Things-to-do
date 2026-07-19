import { expect, test } from "@playwright/test";

test.describe("Discover Proof-to-Pool economic intelligence", () => {
  test("offers the three real entry paths and honest persisted states", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("work your ecosystem depends on");
    await expect(page.getByRole("link", { name: /Use my connected ecosystem/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Analyze a public repository/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Browse community pools/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your connected ecosystem" })).toBeVisible();
    await expect(page.getByLabel("Public GitHub repository")).toBeVisible();
    await expect(page.getByRole("button", { name: /Analyze repository|Refresh snapshot/ })).toBeVisible();
    const allocationDesk = page.getByRole("heading", { name: "How shared capital reaches verified contributors" });
    const noSnapshot = page.getByRole("heading", { name: "Start with a real public repository." });
    await expect(allocationDesk.or(noSnapshot)).toBeVisible();
    if (await allocationDesk.isVisible()) {
      await expect(page.getByText(/No active normalized funding pool|Ledger-backed values/).first()).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Confirmed deposits and community-defined benefits" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText(/Arc|Circle|blockchain/i);
  });

  test("contains the flagship surface at mobile width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 120_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
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
