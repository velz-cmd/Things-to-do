import { expect, test } from "@playwright/test";

test.describe("Discover marketplace composition", () => {
  test("renders four distinct views and survives rapid tab switching", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/discover?view=for_you", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await expect(page.getByRole("heading", { name: "Discover", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your next moves" })).toBeVisible();
    await expect(page.getByText("Economic Action Network", { exact: true })).toHaveCount(0);
    await expect(page.getByText("6 verified capabilities available", { exact: true })).toHaveCount(0);
    await expect(page.getByText("I want to", { exact: true })).toHaveCount(0);

    const discoverTabs = page.getByRole("navigation", { name: "Discover sections" });
    await discoverTabs.getByRole("link", { name: "Explore" }).click();
    await expect(page.getByRole("heading", { name: "Explore verified value" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Marketplace categories" })).toBeVisible();

    await discoverTabs.getByRole("link", { name: "My Activity" }).click();
    await expect(
      page.getByRole("heading", { name: /Your activity|Sign in to view your activity/ }),
    ).toBeVisible();

    await discoverTabs.getByRole("link", { name: "Outcomes" }).click();
    await expect(page.getByRole("heading", { name: "Confirmed outcomes", exact: true })).toBeVisible();

    await discoverTabs.getByRole("link", { name: "For You" }).click();
    await expect(page.getByRole("heading", { name: "Your next moves" })).toBeVisible();
  });

  test("keeps Explore and its category navigation usable on mobile", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/discover?view=explore&kind=all", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await expect(page.getByRole("heading", { name: "Explore verified value" })).toBeVisible();
    const categories = page.getByRole("navigation", { name: "Marketplace categories" });
    await expect(categories.getByRole("link", { name: "People", exact: true })).toBeVisible();
    await categories.getByRole("link", { name: "Pools", exact: true }).click();
    await expect(page).toHaveURL(/view=explore/);
    await expect(page).toHaveURL(/kind=pools/);
    await expect(page.getByRole("heading", { name: /^Pools/ })).toBeVisible();
    await page.getByRole("button", { name: /^Filters/ }).click();
    await page.getByRole("button", { name: "Funded", exact: true }).click();
    await expect(page).toHaveURL(/funding=funded/);
    await categories.getByRole("link", { name: "People", exact: true }).click();
    await expect(page).toHaveURL(/kind=people/);
    await expect(page).toHaveURL(/funding=funded/);
    await expect(page.locator("[data-discover-marketplace]")).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
  });

  test("shows only the final Explore categories without duplicating Outcomes", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/discover?view=explore&kind=all", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    const categories = page.getByRole("navigation", { name: "Marketplace categories" });
    await expect(categories.getByRole("link")).toHaveText(["All", "Work", "People", "Pools"]);
    await expect(categories.getByRole("link", { name: "Outcomes", exact: true })).toHaveCount(0);
    await expect(categories.getByRole("link", { name: "Programs", exact: true })).toHaveCount(0);
    await expect(categories.getByRole("link", { name: "Communities", exact: true })).toHaveCount(0);
  });
});
