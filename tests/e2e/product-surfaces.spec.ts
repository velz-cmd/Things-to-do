import { test, expect } from "@playwright/test";

test.describe("RESOLVE product surfaces", () => {
  test("five-tab IA is reachable", async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: /Open Mission|Claim \$/ }).first(),
    ).toBeVisible();

    await page.goto("/discover", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Where does value already exist?" })).toBeVisible();

    await page.goto("/mission", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Mission" })).toBeVisible();
    await expect(
      page.getByPlaceholder("Describe your funding objective…"),
    ).toBeVisible();

    await page.goto("/communities", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Communities" })).toBeVisible();
    await expect(page.getByText("Browse & install")).toBeVisible();

    await page.goto("/capital", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Where should money move?" })).toBeVisible();
    await expect(page.getByText("RESOLVE Banking · Arc USDC")).toBeVisible();

    await page.goto("/network", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/discover/);

    await page.goto("/communities/independent-music", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Independent Music" })).toBeVisible({
      timeout: 30_000,
    });

    await page.goto("/claim", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/claim/);
    await expect(page.getByRole("heading", { level: 1, name: "Claim earnings" })).toBeVisible();

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Who am I in this ecosystem?" })).toBeVisible();
    await expect(page.getByText("Your earnings", { exact: true })).toBeVisible({ timeout: 15_000 });

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

  test("banking account API returns custody snapshot", async ({ request }) => {
    const res = await request.get("/api/banking/account");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.policy.interestBearing).toBe(false);
    expect(body.policy.rail).toBe("arc");
    expect(body).toHaveProperty("balances");
    expect(body).toHaveProperty("arc");
    expect(body.arc).toHaveProperty("capabilities");
    expect(body.arc.capabilities.batchMemoPayouts).toBe(true);
    expect(body).toHaveProperty("identities");
    expect(body.network).toHaveProperty("pendingFundingUsd");
  });

  test("payments overview API returns treasury and ledger", async ({ request }) => {
    const res = await request.get("/api/payments/overview");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("treasury");
    expect(body).toHaveProperty("ledger");
  });

  test("profile earnings API returns summary shape", async ({ request }) => {
    const res = await request.get("/api/profile/earnings");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty("youEarnedUsd");
    expect(body).toHaveProperty("claimableUsd");
    expect(body).toHaveProperty("identities");
  });

  test("claim session API requires auth", async ({ request }) => {
    const res = await request.get("/api/claim/session");
    expect(res.status()).toBe(401);
  });

  test("notify-claimable cron requires auth in CI", async ({ request }) => {
    const res = await request.post("/api/cron/notify-claimable");
    expect(res.status()).toBe(401);
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Your connections" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Vercel integrations" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Distribution sensors" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Operator keys" })).toBeVisible();
  });

  test("settings status API returns real shape", async ({ request }) => {
    const res = await request.get("/api/settings/status");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.connections)).toBe(true);
    expect(Array.isArray(body.operatorIntegrations)).toBe(true);
    expect(body.operatorIntegrations.some((c: { id: string }) => c.id === "github-sensor")).toBe(true);
    expect(Array.isArray(body.distributionSensors)).toBe(true);
  });

  test("connectors redirect to settings", async ({ page }) => {
    await page.goto("/connectors", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/settings/);
  });

  test("command palette opens", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Open command palette" }).click();
    const dialog = page.getByRole("dialog", { name: "Command palette" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Go to", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});
