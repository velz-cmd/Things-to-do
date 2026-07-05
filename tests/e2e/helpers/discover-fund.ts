import { expect, type APIRequestContext } from "@playwright/test";

export type DiscoverLaneLabel = "Unpaid Value" | "Live Signals" | "Ready to Fund";

/** Clear persisted discover role so lane tabs are predictable across tests. */
export async function prepareDiscoverPage(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("resolve-discover-role");
    } catch {
      /* ignore */
    }
  });
}

export async function waitForDiscoverHero(page: import("@playwright/test").Page) {
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /What value do you want to unlock/i,
    }),
  ).toBeVisible({ timeout: 60_000 });
}

export async function openDiscoverWorkspaceLane(
  page: import("@playwright/test").Page,
  lane: DiscoverLaneLabel,
) {
  await waitForDiscoverHero(page);
  const nav = page.getByRole("navigation", { name: "Discover workspace" });
  await nav.waitFor({ state: "visible", timeout: 45_000 });

  const label =
    lane === "Unpaid Value"
      ? "Unpaid Value"
      : lane === "Live Signals"
        ? "Live Signals"
        : "Ready to Fund";
  await nav.getByRole("button", { name: label }).click();
}

/** Fund intent tab — switches lane to board and scrolls to #opportunities. */
export async function openFundingBoard(page: import("@playwright/test").Page) {
  await prepareDiscoverPage(page);

  const discoverReady = page
    .waitForResponse(
      (res) => res.url().includes("/api/capital/discover") && res.ok(),
      { timeout: 60_000 },
    )
    .catch(() => null);

  await page.goto("/discover", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await waitForDiscoverHero(page);

  const nav = page.getByRole("navigation", { name: "Discover workspace" });
  await nav.waitFor({ state: "visible", timeout: 45_000 });
  await nav.getByRole("button", { name: "Ready to Fund" }).click();
  await expect(nav.locator(".discover-workspace-tab--board")).toHaveClass(
    /discover-workspace-tab--active/,
    { timeout: 15_000 },
  );

  await page.getByRole("tab", { name: /Fund value/i }).click();
  await discoverReady;

  const board = page.locator("#opportunities");
  await expect(board).toBeVisible({ timeout: 60_000 });
  await expect(
    board.getByRole("heading", { name: "Ready to Fund" }),
  ).toBeVisible({ timeout: 60_000 });
}

export type FundableProgram = {
  programId: string;
  communitySlug: string;
  templateId?: string;
};

/** Ensure at least one fundable program exists for the signed-in user. */
export async function ensureFundableProgram(
  request: APIRequestContext,
): Promise<FundableProgram | null> {
  const discoverRes = await request.get("/api/capital/discover");
  if (!discoverRes.ok()) return null;
  const discover = (await discoverRes.json()) as {
    board?: Array<{
      boardKind?: string;
      programId?: string;
      communitySlug?: string;
      templateId?: string;
    }>;
    opportunities?: FundableProgram[];
  };
  const rows = (discover.board ?? discover.opportunities ?? []) as Array<{
    boardKind?: string;
    programId?: string;
    communitySlug?: string;
    templateId?: string;
  }>;
  const program = rows.find(
    (r) => r.boardKind === "program" || (r.programId && r.communitySlug),
  );
  if (program?.programId && program.communitySlug) {
    return {
      programId: program.programId,
      communitySlug: program.communitySlug,
      templateId: program.templateId,
    };
  }

  const slug = "react";
  await request.post(`/api/communities/${slug}/install`).catch(() => null);
  const createRes = await request.post(`/api/communities/${slug}/programs`, {
    data: { templateId: "docs-bounty", name: "E2E Docs Pool", budgetUsd: 0 },
  });
  if (!createRes.ok()) return null;
  const created = (await createRes.json()) as {
    program?: { id: string };
    ok?: boolean;
  };
  const programId = created.program?.id;
  if (!programId) return null;
  return { programId, communitySlug: slug, templateId: "docs-bounty" };
}

export async function fundProgram(
  request: APIRequestContext,
  programId: string,
  amountUsd = 5,
) {
  return request.post("/api/capital/fund", {
    data: { programId, amountUsd },
  });
}

export async function fetchProgramPool(
  request: APIRequestContext,
  communitySlug: string,
  programId: string,
) {
  return request.get(
    `/api/communities/${encodeURIComponent(communitySlug)}/programs/${programId}/pool`,
  );
}

/** Run cron tick to refresh ledger authorizations for receipt proof links. */
export async function refreshLedger(request: APIRequestContext) {
  await request.post("/api/cron/tick").catch(() => null);
}

export async function findReceiptId(request: APIRequestContext): Promise<string | null> {
  const settlementsRes = await request.get("/api/discover/live-settlements?limit=20");
  if (settlementsRes.ok()) {
    const body = (await settlementsRes.json()) as {
      rows?: Array<{ kind?: string; receiptHref?: string }>;
    };
    const auth = body.rows?.find(
      (row) => row.kind === "authorization" && row.receiptHref?.includes("/receipt/"),
    );
    if (auth?.receiptHref) {
      const match = auth.receiptHref.match(/\/receipt\/([^/?#]+)/);
      if (match?.[1]) return match[1];
    }
  }

  const res = await request.get("/api/events/live?limit=20&scope=network");
  if (!res.ok()) return null;
  const body = (await res.json()) as {
    events?: Array<{ id?: string; kind?: string }>;
  };
  const auth = body.events?.find((e) => e.kind === "authorization" && e.id);
  if (!auth?.id) return null;
  return auth.id.replace(/^auth-/, "");
}

/** Network receipt if one exists; otherwise seed Playwright-only proof authorization. */
export async function ensureProofReceipt(
  request: APIRequestContext,
  programId: string,
): Promise<string | null> {
  const existing = await findReceiptId(request);
  if (existing) return existing;

  const res = await request.post("/api/test/e2e/proof-receipt", {
    data: { programId },
  });
  if (!res.ok()) return null;
  const body = (await res.json()) as { receiptId?: string };
  return body.receiptId ?? null;
}

export async function openCapitalActivity(page: import("@playwright/test").Page) {
  await page.goto("/capital", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(
    page.getByRole("heading", { level: 1, name: "Your treasury" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Activity" }).click();
}
