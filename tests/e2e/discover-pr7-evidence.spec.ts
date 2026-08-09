import { expect, test } from "@playwright/test";

test.describe("Discover accepted GitHub evidence", () => {
  test("persists PR #7, survives refresh, and attributes its contributor", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto("/discover?view=explore&kind=work", {
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

    await page.getByRole("link", { name: "People", exact: true }).click();
    await expect(page).toHaveURL(/kind=people/);
    await expect(
      page.getByRole("heading", { name: "velz-cmd", exact: true }),
    ).toBeVisible();
    const personCard = page
      .getByRole("heading", { name: "velz-cmd", exact: true })
      .locator("xpath=ancestor::article");
    await expect(
      personCard.getByText("Accepted work", { exact: true }),
    ).toBeVisible();
    await expect(
      personCard.locator("dd").filter({ hasText: /^1$/ }),
    ).toBeVisible();
  });

  test("keeps the four marketplace categories usable at mobile width", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/discover?view=explore", {
      waitUntil: "domcontentloaded",
    });
    const categories = page.getByRole("navigation", {
      name: "Marketplace categories",
    });
    await expect(categories.getByRole("link")).toHaveText([
      "All",
      "Work",
      "People",
      "Pools",
    ]);
    await categories.getByRole("link", { name: "Work", exact: true }).click();
    await categories.getByRole("link", { name: "Pools", exact: true }).click();
    await categories.getByRole("link", { name: "People", exact: true }).click();
    await expect(page).toHaveURL(/kind=people/);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
