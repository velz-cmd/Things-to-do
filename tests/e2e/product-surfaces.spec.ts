import { test, expect } from "@playwright/test";

test.describe("RESOLVE product surfaces", () => {
  test("mission-based workflows are reachable", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/control", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "What matters right now?" })).toBeVisible();

    await page.goto("/network", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "What changed?" })).toBeVisible();

    await page.goto("/payments", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "What is waiting to move?" })).toBeVisible();

    await page.goto("/connectors", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/discover/);

    await page.goto("/decide", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "What needs funding?" })).toBeVisible();

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Who am I in this network?" })).toBeVisible();

    await page.goto("/workspace", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/control/);
  });

  test("connectors live API returns data", async ({ request }) => {
    const res = await request.get("/api/connectors/live");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.connectors?.length).toBeGreaterThan(0);
    expect(body).toHaveProperty("updatedAt");
  });

  test("workspace OS API returns six questions", async ({ request }) => {
    const res = await request.get("/api/workspace/os");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("headline");
    expect(body).toHaveProperty("sixQuestions");
    expect(Array.isArray(body.sixQuestions)).toBe(true);
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
    expect(body).toHaveProperty("intelligence");
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
