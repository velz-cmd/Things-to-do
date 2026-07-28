import { expect, test, type Page } from "@playwright/test";

const primaryTabs = [
  { id: "discover", path: "/discover" },
  { id: "mission", path: "/mission" },
  { id: "communities", path: "/communities" },
  { id: "earn", path: "/earn" },
  { id: "capital", path: "/capital" },
  { id: "profile", path: "/profile" },
] as const;

async function clickAndReadImmediateState(page: Page, testId: string) {
  return page.evaluate(async (id) => {
    const element = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!element) throw new Error(`Missing navigation tab ${id}`);
    element.click();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return element.getAttribute("data-navigation-state");
  }, testId);
}

async function readNavigationState(page: Page, testId: string) {
  return page.evaluate((id) => {
    return document.querySelector(`[data-testid="${id}"]`)?.getAttribute("data-navigation-state") ?? null;
  }, testId);
}

async function waitForPath(page: Page, path: string) {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe(path);
}

async function clickRapidSequence(page: Page, ids: string[]) {
  return page.evaluate(async (tabIds) => {
    tabIds.forEach((id) => {
      const element = document.querySelector<HTMLElement>(`[data-testid="primary-tab-${id}"]`);
      if (!element) throw new Error(`Missing navigation tab ${id}`);
      element.click();
    });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const latest = tabIds.at(-1);
    return document
      .querySelector(`[data-testid="primary-tab-${latest}"]`)
      ?.getAttribute("data-navigation-state") ?? null;
  }, ids);
}

async function expectResponsiveTabSwitching(page: Page) {
  await page.goto("/mission", { waitUntil: "domcontentloaded" });
  const navigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(navigation).toBeVisible();
  await expect(navigation).toHaveAttribute("data-hydrated", "true");

  for (const tab of primaryTabs) {
    const testId = `primary-tab-${tab.id}`;
    expect(await clickAndReadImmediateState(page, testId)).toMatch(/pending|active/);
    await waitForPath(page, tab.path);
    await expect.poll(() => readNavigationState(page, testId)).toBe("active");
  }

  expect(await clickAndReadImmediateState(page, "primary-tab-home")).toMatch(/pending|active/);
  await waitForPath(page, "/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("primary tab navigation", () => {
  test.setTimeout(240_000);

  test("switches through every primary tab on desktop without getting stuck", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await expectResponsiveTabSwitching(page);
  });

  test("switches through every primary tab on mobile without getting stuck", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expectResponsiveTabSwitching(page);
  });

  test("keeps the latest destination selected during rapid switching", async ({ page }) => {
    await page.goto("/mission", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    const state = await clickRapidSequence(
      page,
      ["discover", "communities", "earn", "capital", "profile", "mission"],
    );
    expect(state).toMatch(/pending|active/);
    await waitForPath(page, "/mission");
    await expect.poll(() => readNavigationState(page, "primary-tab-mission")).toBe("active");
  });

  test("turns a stalled transition into a retryable tab", async ({ page }) => {
    await page.route("**/discover*", async (route) => {
      const headers = route.request().headers();
      if (headers.rsc === "1" || headers["next-router-prefetch"] === "1") {
        await new Promise((resolve) => setTimeout(resolve, 9_000));
        await route.abort("timedout");
        return;
      }
      await route.continue();
    });
    await page.goto("/mission", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveAttribute(
      "data-hydrated",
      "true",
    );

    expect(await clickAndReadImmediateState(page, "primary-tab-discover")).toBe("pending");
    await expect.poll(
      () => readNavigationState(page, "primary-tab-discover"),
      { timeout: 10_000, intervals: [100, 250, 500] },
    ).toBe("failed");
    const recovery = page.getByTestId("primary-tab-discover");
    await expect(recovery).toHaveAttribute("href", "/discover");
    await expect(recovery).toHaveAttribute("title", /Click to retry/);
  });
});
