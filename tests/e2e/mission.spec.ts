import { expect, test } from "@playwright/test";

test("Mission starts with a typed persisted workflow form", async ({ page }) => {
  await page.goto("/mission");
  await expect(page.getByRole("heading", { name: "Build a decision judges can inspect" })).toBeVisible();
  await expect(page.getByLabel("Decision objective")).toBeVisible();
  await expect(page.getByTestId("mission-create")).toBeDisabled();
  await expect(page.getByText("Mission plan")).toBeVisible();
  await expect(page.getByText("Authorize settlement", { exact: false })).toHaveCount(0);
});

test("Mission exposes fields required by each discriminated workflow type", async ({ page }) => {
  await page.goto("/mission");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByLabel("Claim to verify")).toBeVisible();
  await expect(page.getByLabel("Option A")).toHaveCount(0);

  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByLabel("Option A")).toBeVisible();
  await expect(page.getByLabel("Option B")).toBeVisible();
  await expect(page.getByLabel("Criteria, comma separated")).toBeVisible();
});

test("Mission enables creation only after a valid objective is entered", async ({ page }) => {
  await page.goto("/mission");
  const create = page.getByTestId("mission-create");
  await page.getByLabel("Decision objective").fill("Investigate repository evidence for the next release.");
  await expect(create).toBeEnabled();
});
