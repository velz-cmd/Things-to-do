import { test, expect } from "@playwright/test";

test.describe("RESOLVE auth smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("resolve.guest.exploring");
      localStorage.removeItem("resolve.auth.googleBroken");
      localStorage.removeItem("resolve.signin.cooldownUntil");
    });
  });

  test("1. sign-in modal opens", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  });

  test("2. close button closes modal", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("3. continue without sign-in shows Guest", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Continue without sign-in" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Guest" })).toBeVisible();
  });

  test("4. continue with wallet opens wallet picker", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Continue with wallet" }).click();
    await expect(page.getByRole("heading", { name: "Choose wallet" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Connect|WalletConnect/ }).first()
    ).toBeVisible();
  });

  test("8. refresh does not leave stuck modal", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.reload();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /Sign in|Guest/ })).toBeVisible();
  });

  test("9-10. only configured auth methods are visible", async ({ page }) => {
    const caps = await page.request.get("/api/auth/capabilities");
    const data = await caps.json();

    await page.getByRole("button", { name: "Sign in" }).click();

    if (!data.email) {
      await expect(page.getByPlaceholder("you@company.com")).not.toBeVisible();
    } else {
      await expect(page.getByPlaceholder("you@company.com")).toBeVisible();
    }

    if (!data.google) {
      await expect(
        page.getByRole("button", { name: "Continue with Google" })
      ).not.toBeVisible();
    }

    await expect(
      page.getByRole("button", { name: "Continue with wallet" })
    ).toBeVisible();

    await expect(
      page.getByText(/temporarily unavailable/i)
    ).not.toBeVisible();
  });

  test("11. guest button always works", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("button", { name: "Continue without sign-in" }).click();
    await expect(page.getByRole("button", { name: "Guest" })).toBeVisible();
  });

  test("12. no eternal loader on welcome screen", async ({ page }) => {
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForTimeout(2000);
    const waiting = page.getByText("Waiting for wallet…");
    await expect(waiting).not.toBeVisible();
    const redirecting = page.getByText("Redirecting…");
    await expect(redirecting).not.toBeVisible();
  });
});
