import { expect, test } from "@playwright/test";

/**
 * Automated, repeatable responsive coverage for Discover - replaces the
 * one-off manual Playwright checks with a durable test artifact. Runs
 * unauthenticated (no E2E secrets required), so it executes on every CI
 * pass rather than only when live Supabase/E2E credentials are configured.
 */
const BREAKPOINTS = [
  { width: 1600, height: 900, label: "1600" },
  { width: 1440, height: 900, label: "1440" },
  { width: 1280, height: 900, label: "1280" },
  { width: 1024, height: 900, label: "1024" },
  { width: 390, height: 844, label: "390" },
];

const VIEWS = ["verified_work", "requests", "pools", "agents", "activity"];

test.describe("Discover responsive invariants", () => {
  for (const bp of BREAKPOINTS) {
    for (const view of VIEWS) {
      test(`no horizontal overflow at ${bp.label}px on ${view}`, async ({ page }) => {
        test.setTimeout(60_000);
        await page.setViewportSize({ width: bp.width, height: bp.height });
        await page.goto(`/discover?view=${view}`, {
          waitUntil: "domcontentloaded",
          timeout: 45_000,
        });
        await expect(page.getByRole("heading", { name: "Discover", exact: true })).toBeVisible();

        const overflow = await page.evaluate(() => {
          const docWidth = document.documentElement.scrollWidth;
          const viewWidth = document.documentElement.clientWidth;
          return docWidth - viewWidth;
        });
        // Small rounding slack (scrollbar/subpixel), never a real overflow.
        expect(overflow).toBeLessThanOrEqual(2);
      });
    }
  }

  test("mobile: primary Discover tabs stay reachable and usable", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/discover?view=verified_work", {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    const tabs = page.getByRole("navigation", { name: "Discover sections" });
    for (const name of ["Verified Work", "Open Requests", "Pools", "Agent Marketplace", "Activity"]) {
      await expect(tabs.getByRole("link", { name })).toBeVisible();
    }
  });
});
