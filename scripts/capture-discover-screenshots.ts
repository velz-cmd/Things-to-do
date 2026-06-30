/**
 * Capture Discover acceptance screenshots (run after D1–D2).
 * Usage: PLAYWRIGHT_ENABLED=true npx tsx scripts/capture-discover-screenshots.ts
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "artifacts", "discover-screenshots");

async function shot(page: import("playwright").Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log(`✓ ${name}.png`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // 1. Signed out
  const signedOut = await ctx.newPage();
  await signedOut.goto(`${BASE}/discover`, { waitUntil: "domcontentloaded" });
  await shot(signedOut, "01-signed-out");

  // 2. Signed in no sensors — requires auth cookie; capture login prompt state as proxy if unavailable
  const signedIn = await ctx.newPage();
  await signedIn.goto(`${BASE}/discover`, { waitUntil: "domcontentloaded" });
  await shot(signedIn, "02-signed-in-or-default");

  // 3. GitHub scan surfaces (trending OSS)
  await signedIn.locator("#trending").scrollIntoViewIfNeeded();
  await shot(signedIn, "03-trending-github-scan");

  // 4. Funding flow — fund sheet trigger via first Fund chip if present
  const fundBtn = signedIn.getByRole("button", { name: /^Fund/i }).first();
  if (await fundBtn.isVisible().catch(() => false)) {
    await fundBtn.click();
    await signedIn.waitForTimeout(400);
    await shot(signedIn, "04-funding-flow-sheet");
    await signedIn.keyboard.press("Escape");
  } else {
    await shot(signedIn, "04-funding-flow-unavailable");
  }

  // 5. Bubblemap node action panel
  const bubble = signedIn.locator("svg[aria-label='Value bubblemap'] circle").first();
  if (await bubble.isVisible().catch(() => false)) {
    await bubble.click();
    await signedIn.waitForTimeout(300);
    await shot(signedIn, "05-bubblemap-node-panel");
    await signedIn.getByLabel("Close panel").click().catch(() => {});
  } else {
    await shot(signedIn, "05-bubblemap-empty");
  }

  // 6. Empty state — filter to nonsense query
  await signedIn.goto(`${BASE}/discover`, { waitUntil: "domcontentloaded" });
  const search = signedIn.locator('input[type="search"], input[placeholder*="Search"]').first();
  if (await search.isVisible().catch(() => false)) {
    await search.fill("zzzzno-match-zzzz");
    await signedIn.waitForTimeout(300);
  }
  await shot(signedIn, "06-empty-filtered-state");

  await browser.close();
  console.log(`Screenshots saved to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
