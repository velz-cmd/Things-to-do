/**
 * Browser executor integration — run: PLAYWRIGHT_ENABLED=true npx tsx scripts/test-browser-executor.ts
 */
import assert from "node:assert/strict";
import { streamlyCancellationRecipe } from "../src/lib/browser/browser-recipes";
import { browserExecutor } from "../src/lib/browser/browser-executor";
import { getAppBaseUrl } from "../src/lib/browser/app-url";

async function main() {
  process.env.PLAYWRIGHT_ENABLED = "true";
  process.env.PLAYWRIGHT_FORCE = "true";

  const base = getAppBaseUrl();
  console.log(`Using app base URL: ${base}`);

  const input = streamlyCancellationRecipe({
    taskId: "browser-test-task",
    email: "executor-test@resolve.app",
    userApprovedFinalSubmit: true,
  });

  const result = await browserExecutor.run(input);

  assert.ok(result.proofs.length >= 2, "expected screenshots and text proof");
  assert.ok(
    result.extractedText.some((t) => t.includes("Subscription cancelled")),
    "expected confirmation text"
  );
  console.log("✓ browser executor captured confirmation proof");
  console.log(`  proofs: ${result.proofs.length}, errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.warn("  warnings:", result.errors);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
