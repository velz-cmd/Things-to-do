import { test, expect } from "@playwright/test";

test.describe("RESOLVE product surfaces", () => {
  test("four workflows are reachable", async ({ page }) => {
    await page.goto("/workspace");
    await expect(
      page.getByRole("heading", { name: /operating system for open ecosystems/i }),
    ).toBeVisible();

    await page.goto("/payments");
    await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();

    await page.goto("/connectors");
    await expect(page).toHaveURL(/\/workspace/);
    await expect(
      page.getByRole("heading", { name: /operating system for open ecosystems/i }),
    ).toBeVisible();

    await page.goto("/profile");
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
  });

  test("payments overview API returns treasury and ledger", async ({ request }) => {
    const res = await request.get("/api/payments/overview");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("treasury");
    expect(body).toHaveProperty("ledger");
  });
});
