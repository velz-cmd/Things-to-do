import { expect, test } from "@playwright/test";
import { creditE2EBalance, signInForE2E } from "./helpers/auth";
import {
  ensureFundableProgram,
  ensureProofReceipt,
  fetchProgramPool,
  fundProgram,
  openCapitalActivity,
  refreshLedger,
} from "./helpers/discover-fund";

test.describe("Discover handoff to Capital and proof", () => {
  test("full E2E: fund in Capital, inspect activity, and open receipt proof", async ({ page }) => {
    test.setTimeout(180_000);

    const signIn = await signInForE2E(page.request);
    test.skip(!signIn.ok, signIn.ok ? "" : signIn.reason);

    await creditE2EBalance(page.request, 30);
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

  test("signed-in API funding updates the Pool", async ({ page }) => {
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

  test("Discover has no settlement authority or direct funding control", async ({ page }) => {
    await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /Fulfill pool/i })).toHaveCount(0);
    await expect(page.getByRole("main").locator('input[type="number"]')).toHaveCount(0);
  });
});
