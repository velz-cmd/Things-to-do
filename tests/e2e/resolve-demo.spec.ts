import { test, expect } from "@playwright/test";

test.describe("Streamly demo portal", () => {
  test("subscription cancellation shows confirmation", async ({ page }) => {
    await page.goto("/demo-portals/streamly");

    await expect(page.getByTestId("streamly-account")).toBeVisible();
    await page.getByTestId("account-email").fill("judge@resolve.app");
    await page.getByTestId("cancel-start").click();

    await expect(page.getByTestId("cancel-form")).toBeVisible();
    await page.getByTestId("cancel-reason").fill("Demo cancellation for RESOLVE");
    await page.getByTestId("cancel-submit").click();

    await expect(page.getByTestId("streamly-confirmation")).toBeVisible();
    const confirmation = page.locator('[data-proof="confirmation"]');
    await expect(confirmation).toContainText("Confirmation SUB-");
  });

  test("refund claim mode shows claim confirmation", async ({ page }) => {
    await page.goto("/demo-portals/streamly?mode=claim");

    await page.getByTestId("account-email").fill("judge@resolve.app");
    await page.getByTestId("claim-amount").fill("43.00");
    await page.getByTestId("claim-submit").click();

    await expect(page.getByTestId("streamly-confirmation")).toBeVisible();
    await expect(page.locator('[data-proof="confirmation"]')).toContainText(
      "TKT-"
    );
  });
});

test.describe("RESOLVE backend APIs", () => {
  test("settlement config is reachable", async ({ request }) => {
    const response = await request.get("/api/settlement/config");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body).toHaveProperty("mode");
  });

  test("invalid tx hash is rejected by verify endpoint", async ({ request }) => {
    const response = await request.get("/api/settlement/verify-tx/not-a-hash");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.verification?.found).toBeFalsy();
  });
});
