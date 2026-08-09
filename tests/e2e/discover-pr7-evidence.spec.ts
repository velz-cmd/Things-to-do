import { expect, test } from "@playwright/test";

test.describe("Discover accepted GitHub evidence", () => {
  test("persists PR #7, survives refresh, and attributes its contributor", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/discover?view=verified_work", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });

    const repositoryInput = page.getByLabel("Public GitHub repository");
    const analyzeButton = page.getByRole("button", {
      name: "Analyse",
      exact: true,
    });
    await expect(analyzeButton).toBeEnabled();
    await repositoryInput.fill("velz-cmd/repodiet-e2e-test");
    await expect(repositoryInput).toHaveValue("velz-cmd/repodiet-e2e-test");
    await analyzeButton.click();

    await expect(
      page.getByText("Evidence saved to Discover", { exact: true }),
    ).toBeVisible({
      timeout: 120_000,
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });

    const workTitle = "Add RESOLVE accepted-work verification evidence";
    await expect(page.getByText(workTitle, { exact: true })).toBeVisible({
      timeout: 120_000,
    });
    await expect(
      page.getByText("velz-cmd / documentation", { exact: true }),
    ).toBeVisible();

    const workRow = page
      .getByRole("heading", { name: workTitle, exact: true })
      .locator("xpath=ancestor::article");
    await expect(
      workRow.getByText("Evidence verified", { exact: true }),
    ).toBeVisible();
    await expect(
      workRow.getByText("Not currently covered", { exact: true }),
    ).toBeVisible();
    await workRow
      .getByRole("button", { name: "Inspect evidence", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Inspect evidence" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Evidence ID", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText("@velz-cmd", { exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "Open GitHub evidence" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/velz-cmd/repodiet-e2e-test/pull/7",
    );
    await dialog.getByRole("button", { name: "Close Discover action" }).click();

    await expect(
      workRow.getByRole("button", {
        name: /Reward this work|Choose payout wallet|Inspect evidence/,
      }),
    ).toBeVisible();
  });

  test("keeps the four Discover products usable at mobile width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/discover?view=verified_work", {
      waitUntil: "domcontentloaded",
    });
    const categories = page.getByRole("navigation", {
      name: "Discover sections",
    });
    await expect(categories.getByRole("link")).toHaveText([
      "Verified Work",
      "Open Requests",
      "Pools",
      "Activity",
    ]);
    await categories.getByRole("link", { name: "Pools", exact: true }).click();
    await expect(page).toHaveURL(/view=pools/);
    await expect(
      page.getByRole("heading", {
        name: "Pools with visible rules, treasury state, and receipts",
      }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
