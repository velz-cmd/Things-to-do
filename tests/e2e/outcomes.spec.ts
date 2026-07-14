import { expect, test } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

async function signInForOutcomeE2E(request: APIRequestContext) {
  const capabilities = await request.get("/api/auth/capabilities");
  if (!capabilities.ok()) return { ok: false as const, reason: "auth capabilities unavailable" };
  const available = await capabilities.json() as { supabase?: boolean; emailPassword?: boolean };
  if (!available.supabase || !available.emailPassword) return { ok: false as const, reason: "Supabase email-password auth not configured" };
  const email = process.env.E2E_TEST_EMAIL?.trim() || `outcome-e2e-${process.env.GITHUB_RUN_ID ?? Date.now()}@resolve-e2e.test`;
  const password = process.env.E2E_TEST_PASSWORD?.trim() || "resolve-e2e-test-99";
  const response = await request.post("/api/auth/email-password", { data: { email, password } });
  if (!response.ok()) return { ok: false as const, reason: `sign-in failed (${response.status()})` };
  return { ok: true as const, email };
}

test("Earn explains the contributor outcome loop without invented value", async ({ page }) => {
  await page.goto("/earn");
  await expect(page.getByRole("heading", { name: "Work on real outcomes. Get paid when the proof is real." })).toBeVisible();
  await expect(page.getByText("Available to claim")).toBeVisible();
  await expect(page.getByText("Sign in before joining or submitting to a funded campaign.")).toBeVisible();
});

test("authenticated campaign proceeds from simulation to public Arc receipt", async ({ page }) => {
  test.setTimeout(180_000);
  const signIn = await signInForOutcomeE2E(page.request);
  test.skip(!signIn.ok, signIn.ok ? "" : signIn.reason);

  const seedResponse = await page.request.post("/api/test/e2e/outcomes", { data: { action: "seed_creator" } });
  expect(seedResponse.ok()).toBeTruthy();
  const seed = await seedResponse.json() as { campaignId: string; campaignName: string };

  await page.goto("/earn?mode=creator");
  await expect(page.getByRole("heading", { name: "Turn content and projects into verified growth campaigns." })).toBeVisible();
  await expect(page.getByText(seed.campaignName)).toBeVisible();

  const simulated = await page.request.post(`/api/outcomes/campaigns/${seed.campaignId}/simulate`);
  expect(simulated.ok()).toBeTruthy();
  const approved = await page.request.post(`/api/outcomes/campaigns/${seed.campaignId}/approve`);
  expect(approved.ok()).toBeTruthy();
  const approval = await approved.json() as { fundingIntentId: string };
  const funded = await page.request.patch(`/api/capital/funding-intents/${approval.fundingIntentId}`, { data: { status: "confirmed", txHash: `0x${"ab".repeat(32)}`, activityId: `e2e-${seed.campaignId}` } });
  expect(funded.ok()).toBeTruthy();
  const published = await page.request.post(`/api/outcomes/campaigns/${seed.campaignId}/publish`);
  expect(published.ok()).toBeTruthy();

  await page.goto("/discover?mode=campaigns#outcome-campaigns");
  await expect(page.getByTestId("outcome-campaigns").getByText(seed.campaignName)).toBeVisible({ timeout: 30_000 });
  const joined = await page.request.post(`/api/outcomes/campaigns/${seed.campaignId}/participants`);
  expect(joined.ok()).toBeTruthy();
  const identityResponse = await page.request.post("/api/outcomes/identity", { data: { action: "connect_identity", provider: "github" } });
  expect(identityResponse.ok()).toBeTruthy();
  const identity = await identityResponse.json() as { identityId: string };
  const payout = await page.request.post("/api/outcomes/identity", { data: { action: "bind_payout", identityId: identity.identityId } });
  expect(payout.ok()).toBeTruthy();

  const recognition = await page.request.post("/api/test/e2e/outcomes", { data: { action: "seed_recognition", campaignId: seed.campaignId } });
  expect(recognition.ok()).toBeTruthy();
  const settlementResponse = await page.request.post(`/api/outcomes/campaigns/${seed.campaignId}/settlement`);
  expect(settlementResponse.ok()).toBeTruthy();
  const settlement = await settlementResponse.json() as { settlementBatchId: string };
  const confirmed = await page.request.post("/api/test/e2e/outcomes", { data: { action: "confirm_settlement", settlementBatchId: settlement.settlementBatchId } });
  expect(confirmed.ok()).toBeTruthy();
  const confirmation = await confirmed.json() as { receiptUrl: string };
  expect(confirmation.receiptUrl).toMatch(/^\/outcomes\/out_/);

  await page.goto(confirmation.receiptUrl);
  await expect(page.getByText("Verified outcome receipt")).toBeVisible();
  await expect(page.getByText(seed.campaignName)).toBeVisible();
  await expect(page.getByText("5 USDC")).toBeVisible();
});
