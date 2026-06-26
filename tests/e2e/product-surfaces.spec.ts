import { test, expect } from "@playwright/test";

test.describe("RESOLVE product surfaces", () => {
  test("four workflows are reachable", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/workspace");
    await expect(page.getByRole("heading", { name: "Resolve Workspace" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Chat", { exact: true })).toBeVisible();

    await page.goto("/payments");
    await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();

    await page.goto("/connectors", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/workspace/, { timeout: 15_000 });
    await expect(page.getByText("Chat", { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  });

  test("connectors live API returns data", async ({ request }) => {
    const res = await request.get("/api/connectors/live");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.connectors?.length).toBeGreaterThan(0);
    expect(body).toHaveProperty("updatedAt");
  });

  test("workspace overview API returns OS payload", async ({ request }) => {
    const res = await request.get("/api/workspace/overview");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("tagline");
    expect(body).toHaveProperty("sources");
    expect(body).toHaveProperty("liveActivity");
    expect(body).toHaveProperty("capitalFlow");
  });

  test("workspace ask API returns protocol welcome and snapshot", async ({ request }) => {
    const res = await request.get("/api/workspace/ask");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("greeting");
    expect(body).toHaveProperty("naturalLanguageActions");
    expect(body.requiresApproval).toBe(true);
  });

  test("payments overview API returns treasury and ledger", async ({ request }) => {
    const res = await request.get("/api/payments/overview");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("treasury");
    expect(body).toHaveProperty("ledger");
  });
});
