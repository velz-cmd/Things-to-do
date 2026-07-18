import { expect, test } from "@playwright/test";

test.describe("Capital and Profile entry surfaces", () => {
  test("Profile is reachable alongside Earn and preserves its identity purpose", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Your identity control plane" })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Earn" })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Profile" })).toBeVisible();
  });

  test("Capital and Profile guest entries remain contained on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/capital", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Sign in to open Capital" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Your identity control plane" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
