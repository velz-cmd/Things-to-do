import { test, expect } from "@playwright/test";

test.describe("RESOLVE product surfaces", () => {
  test("five-area IA is reachable", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: "Open Mission" }).first()).toBeVisible();

    await page.goto("/discover", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Where does value already exist?" })).toBeVisible();

    await page.goto("/mission", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Mission" })).toBeVisible();
    await expect(
      page.getByPlaceholder("Describe your funding objective…"),
    ).toBeVisible();

    await page.goto("/capital", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Where should money move?" })).toBeVisible();

    await page.goto("/network", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/discover/);

    await page.goto("/communities/independent-music", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Independent Music" })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Who am I in this ecosystem?" })).toBeVisible();

    await page.goto("/control", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/mission/);
  });

  test("communities API returns catalog", async ({ request }) => {
    const res = await request.get("/api/communities");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.communities?.length).toBeGreaterThan(0);
  });

  test("connectors live API returns data", async ({ request }) => {
    const res = await request.get("/api/connectors/live");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.connectors?.length).toBeGreaterThan(0);
  });

  test("workspace OS API returns six questions", async ({ request }) => {
    const res = await request.get("/api/workspace/os");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("sixQuestions");
  });

  test("workspace overview API returns intelligence", async ({ request }) => {
    const res = await request.get("/api/workspace/overview");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("intelligence");
  });

  test("payments overview API returns treasury and ledger", async ({ request }) => {
    const res = await request.get("/api/payments/overview");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("treasury");
    expect(body).toHaveProperty("ledger");
  });
});
