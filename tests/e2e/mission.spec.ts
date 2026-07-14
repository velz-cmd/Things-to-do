import { expect, test } from "@playwright/test";

test("Mission presents the evidence-to-decision compiler without execution controls", async ({ page }) => {
  await page.goto("/mission");
  await expect(page.getByRole("heading", { name: "Define a decision. Compile only the evidence it needs." })).toBeVisible();
  await expect(page.getByLabel("Objective")).toBeVisible();
  await expect(page.getByTestId("mission-action-mission.investigate")).toBeDisabled();
  await expect(page.getByText("Evidence debt is explicit; no confidence score is shown.")).toBeVisible();
  await expect(page.getByText("Authorize settlement", { exact: false })).toHaveCount(0);
});

test("Mission enables an evidence investigation after objective input", async ({ page }) => {
  await page.goto("/mission");
  await page.getByLabel("Objective").fill("Verify authorship for the documentation release.");
  const action = page.getByTestId("mission-action-mission.investigate");
  await expect(action).toBeEnabled();
  await action.click();
  await expect(page.getByText("Objective accepted. The investigation scope is ready for approved sources.")).toBeVisible();
});
