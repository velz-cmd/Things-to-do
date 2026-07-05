import type { APIRequestContext, Page } from "@playwright/test";

export type E2ESignInResult =
  | { ok: true; email: string }
  | { ok: false; reason: string };

/** Server email-password sign-in — auto-creates account when Supabase admin is configured. */
export async function signInForE2E(
  request: APIRequestContext,
): Promise<E2ESignInResult> {
  const capsRes = await request.get("/api/auth/capabilities");
  if (!capsRes.ok()) {
    return { ok: false, reason: "auth capabilities unavailable" };
  }
  const caps = (await capsRes.json()) as {
    supabase?: boolean;
    emailPassword?: boolean;
  };
  if (!caps.supabase || !caps.emailPassword) {
    return { ok: false, reason: "Supabase email-password auth not configured" };
  }

  const email =
    process.env.E2E_TEST_EMAIL?.trim() ||
    `e2e-ci-${process.env.GITHUB_RUN_ID ?? Date.now()}@resolve-e2e.test`;
  const password =
    process.env.E2E_TEST_PASSWORD?.trim() || "resolve-e2e-test-99";

  const res = await request.post("/api/auth/email-password", {
    data: { email, password },
  });
  if (!res.ok()) {
    const body = await res.json().catch(() => ({}));
    return {
      ok: false,
      reason: `sign-in failed (${res.status()}): ${(body as { error?: string }).error ?? "unknown"}`,
    };
  }

  return { ok: true, email };
}

/** Credit spendable USDC for fund E2E — only available when PLAYWRIGHT_ENABLED=true. */
export async function creditE2EBalance(
  request: APIRequestContext,
  amountUsd = 25,
): Promise<boolean> {
  const res = await request.post("/api/test/e2e/credit-balance", {
    data: { amountUsd },
  });
  return res.ok();
}

export async function ensureSignedInPage(page: Page): Promise<E2ESignInResult> {
  const result = await signInForE2E(page.request);
  if (!result.ok) return result;
  await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const session = await page.request.get("/api/auth/capabilities");
  if (!session.ok()) {
    return { ok: false, reason: "session not established after sign-in" };
  }
  return result;
}
