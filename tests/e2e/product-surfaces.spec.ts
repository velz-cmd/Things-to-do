import { test, expect } from "@playwright/test";

test.describe("RESOLVE product surfaces", () => {
  test("four workflows are reachable", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/workspace", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Workspace" })).toBeVisible();
    await expect(page.getByText("Here's what is already happening")).toBeVisible();
    await expect(page.getByRole("button", { name: "Find value leaks" }).first()).toBeVisible();

    await page.goto("/activity", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();

    await page.goto("/payments", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Payments" })).toBeVisible();

    await page.goto("/connectors", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/activity/);
    await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();

    await page.goto("/workspace/fund", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Fund contributors" })).toBeVisible();

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Profile" })).toBeVisible();
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
    expect(body).toHaveProperty("domainIntelligence");
    expect(body).toHaveProperty("network");
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
