import { test, expect } from "@playwright/test";
import {
  creditE2EBalance,
  ensureSignedInPage,
  signInForE2E,
} from "./helpers/auth";
import {
  ensureFundableProgram,
  ensureProofReceipt,
  fetchProgramPool,
  fundProgram,
  openCapitalActivity,
  openFundingBoard,
  refreshLedger,
} from "./helpers/discover-fund";

test.describe("Discover fund → pool → capital → proof", () => {
  test("full E2E: sign in → fulfill $5 → pool bar → capital activity → receipt proof", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const signIn = await signInForE2E(page.request);
    test.skip(!signIn.ok, signIn.ok ? "" : signIn.reason);

    const credited = await creditE2EBalance(page.request, 30);
    expect(credited).toBeTruthy();

    const program = await ensureFundableProgram(page.request);
    test.skip(!program, "no fundable program");

    const poolBeforeRes = await fetchProgramPool(
      page.request,
      program.communitySlug,
      program.programId,
    );
    const poolBefore = poolBeforeRes.ok()
      ? ((await poolBeforeRes.json()) as { pool?: { poolBalanceUsd?: number } }).pool
          ?.poolBalanceUsd ?? 0
      : 0;

    await openFundingBoard(page);

    const board = page.locator("#opportunities");
    const amountInput = board.locator('input[type="number"]').first();
    await expect(amountInput).toBeVisible({ timeout: 30_000 });
    await amountInput.fill("5");

    const fundReady = page.waitForResponse(
      (res) => res.url().includes("/api/capital/fund") && res.ok(),
      { timeout: 90_000 },
    );
    await board.getByRole("button", { name: "Fulfill pool" }).first().click();
    await fundReady;

    await expect(board.getByText(/Pool checkpoint|in pool/i).first()).toBeVisible({
      timeout: 30_000,
    });

    const poolAfterRes = await fetchProgramPool(
      page.request,
      program.communitySlug,
      program.programId,
    );
    expect(poolAfterRes.ok()).toBeTruthy();
    const poolAfter = (await poolAfterRes.json()) as {
      pool?: { poolBalanceUsd?: number; funder?: { yourDepositUsd?: number } };
    };
    expect((poolAfter.pool?.poolBalanceUsd ?? 0) >= poolBefore + 4.99).toBeTruthy();
    expect((poolAfter.pool?.funder?.yourDepositUsd ?? 0) >= 5).toBeTruthy();

    const capitalRes = await page.request.get("/api/capital/state?refresh=1");
    expect(capitalRes.ok()).toBeTruthy();
    const capital = (await capitalRes.json()) as {
      activity?: Array<{ kind?: string }>;
    };
    expect(capital.activity?.some((row) => row.kind === "fund_program")).toBeTruthy();

    await openCapitalActivity(page);
    await expect(page.getByText(/You funded|funded/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await refreshLedger(page.request);
    const receiptId = await ensureProofReceipt(page.request, program.programId);
    expect(receiptId).toBeTruthy();
    if (!receiptId) return;

    const proofRes = await page.request.get(`/api/receipt/${receiptId}`);
    expect(proofRes.ok()).toBeTruthy();

    await page.goto(`/receipt/${receiptId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Verified receipt|Earning receipt/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("signed-in API fund $5 updates pool without UI", async ({ page }) => {
    test.setTimeout(120_000);

    const signIn = await signInForE2E(page.request);
    test.skip(!signIn.ok, signIn.ok ? "" : signIn.reason);

    await creditE2EBalance(page.request, 25);
    const program = await ensureFundableProgram(page.request);
    test.skip(!program, "no fundable program");

    const poolBeforeRes = await fetchProgramPool(
      page.request,
      program.communitySlug,
      program.programId,
    );
    const poolBefore = poolBeforeRes.ok()
      ? ((await poolBeforeRes.json()) as { pool?: { poolBalanceUsd?: number } }).pool
          ?.poolBalanceUsd ?? 0
      : 0;

    const fundRes = await fundProgram(page.request, program.programId, 5);
    expect(fundRes.ok()).toBeTruthy();

    const poolAfterRes = await fetchProgramPool(
      page.request,
      program.communitySlug,
      program.programId,
    );
    expect(poolAfterRes.ok()).toBeTruthy();
    const poolAfter = (await poolAfterRes.json()) as {
      pool?: { poolBalanceUsd?: number };
    };
    expect((poolAfter.pool?.poolBalanceUsd ?? 0) >= poolBefore + 4.99).toBeTruthy();
  });

  test("UI fulfill pool on funding board", async ({ page }) => {
    test.setTimeout(180_000);

    const signIn = await ensureSignedInPage(page);
    test.skip(!signIn.ok, signIn.ok ? "" : signIn.reason);

    await creditE2EBalance(page.request, 30);
    const program = await ensureFundableProgram(page.request);
    test.skip(!program, "no fundable program");

    await openFundingBoard(page);

    const board = page.locator("#opportunities");
    const amountInput = board.locator('input[type="number"]').first();
    await amountInput.fill("5");

    const fundReady = page.waitForResponse(
      (res) => res.url().includes("/api/capital/fund") && res.ok(),
      { timeout: 90_000 },
    );
    await board.getByRole("button", { name: "Fulfill pool" }).first().click();
    await fundReady;

    await expect(board.getByText(/Pool checkpoint|in pool/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
