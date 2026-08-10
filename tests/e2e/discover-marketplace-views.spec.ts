import { expect, test } from "@playwright/test";

test.describe("Discover marketplace composition", () => {
  test("opens with a compact action landing instead of an empty dashboard", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("link", { name: /Fund proven work/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Post or take a request/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Back a shared Pool/ })).toBeVisible();
    await expect(page.getByText(/^Work 0$|^Requests 0$|^Pools 0$|^Receipts 0$/)).toHaveCount(0);

    await page
      .getByRole("navigation", { name: "Discover sections" })
      .getByRole("link", { name: "Verified Work" })
      .click();
    await expect(page).toHaveURL(/view=verified_work/);
    await expect(
      page.getByRole("heading", {
        name: "Verify the work, then reward the person who did it",
      }),
    ).toBeVisible();
  });

  test("renders five distinct economic views and survives rapid tab switching", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/discover?view=verified_work", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await expect(page.getByRole("heading", { name: "Discover", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verify the work, then reward the person who did it" })).toBeVisible();
    await expect(page.getByText("Economic Action Network", { exact: true })).toHaveCount(0);
    await expect(page.getByText("6 verified capabilities available", { exact: true })).toHaveCount(0);
    await expect(page.getByText("I want to", { exact: true })).toHaveCount(0);

    const discoverTabs = page.getByRole("navigation", { name: "Discover sections" });
    await discoverTabs.getByRole("link", { name: "Open Requests" }).click();
    await expect(page.getByRole("heading", { name: "Ask for useful work, with proof and payment terms" })).toBeVisible();

    await discoverTabs.getByRole("link", { name: "Pools" }).click();
    await expect(page.getByRole("heading", { name: "Pools with visible rules, treasury state, and receipts" })).toBeVisible();

    await discoverTabs.getByRole("link", { name: "Agent Marketplace" }).click();
    await expect(page.getByRole("heading", { name: "Agent Marketplace" })).toBeVisible();
    await expect(page.getByText("Sentiment", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/USDC \/ request/).first()).toBeVisible();

    await discoverTabs.getByRole("link", { name: "Activity" }).click();
    await expect(page.getByText(/Sign in to view your economic activity|Activity and receipts/)).toBeVisible();

    await discoverTabs.getByRole("link", { name: "Verified Work" }).click();
    await expect(page.getByRole("heading", { name: "Verify the work, then reward the person who did it" })).toBeVisible();
  });

  test("keeps all five products usable on mobile", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/discover?view=verified_work", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    const tabs = page.getByRole("navigation", { name: "Discover sections" });
    await expect(tabs.getByRole("link")).toHaveText(["Verified Work", "Open Requests", "Pools", "Agent Marketplace", "Activity"]);
    await tabs.getByRole("link", { name: "Open Requests" }).click();
    await expect(page).toHaveURL(/view=requests/);
    await tabs.getByRole("link", { name: "Pools" }).click();
    await expect(page).toHaveURL(/view=pools/);
    await tabs.getByRole("link", { name: "Agent Marketplace" }).click();
    await expect(page).toHaveURL(/view=agents/);
    await expect(page.getByRole("heading", { name: "Agent Marketplace" })).toBeVisible();
    await expect(page.locator("[data-discover-marketplace]")).toBeVisible();
    await expect(page.getByRole("main")).toHaveCount(1);
  });

  test("does not expose the removed generic marketplace categories", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/discover?view=requests", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    await expect(page.getByRole("navigation", { name: "Marketplace categories" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "People", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Outcomes", exact: true })).toHaveCount(0);
  });
});
