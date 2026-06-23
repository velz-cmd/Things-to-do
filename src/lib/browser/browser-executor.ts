import type { Page } from "playwright";
import type {
  BrowserAction,
  BrowserProof,
  BrowserRunInput,
  BrowserRunResult,
} from "@/lib/browser/browser-types";
import {
  detectRiskSignals,
  enforceSafety,
  maskActionForLog,
  shouldBlockSubmit,
  timelineLabelForAction,
} from "@/lib/browser/browser-safety";
import { saveProofArtifact } from "@/lib/browser/browser-proof";

type PendingProof = {
  type: BrowserProof["type"];
  title: string;
  buffer?: Buffer;
  text?: string;
};

async function executeAction(
  page: Page,
  action: BrowserAction,
  taskId: string,
  extractedText: string[],
  pendingProofs: PendingProof[]
): Promise<void> {
  switch (action.type) {
    case "goto":
      await page.goto(action.url, {
        waitUntil: "domcontentloaded",
        timeout: action.url.includes("localhost") ? 30000 : 20000,
      });
      break;
    case "click":
      await page.locator(action.selector).click();
      break;
    case "fill":
      await page.locator(action.selector).fill(action.value);
      break;
    case "select":
      await page.locator(action.selector).selectOption(action.value);
      break;
    case "upload": {
      const { access } = await import("fs/promises");
      await access(action.filePath);
      await page.locator(action.selector).setInputFiles(action.filePath);
      break;
    }
    case "waitForText":
      await page.getByText(action.text).waitFor({
        timeout: action.timeoutMs ?? 15000,
      });
      break;
    case "waitForSelector":
      await page.locator(action.selector).waitFor({
        timeout: action.timeoutMs ?? 15000,
      });
      break;
    case "screenshot": {
      const buffer = await page.screenshot({ type: "png", fullPage: true });
      pendingProofs.push({
        type: "screenshot",
        title: action.title,
        buffer,
      });
      break;
    }
    case "download": {
      const download = await page.waitForEvent("download", { timeout: 15000 });
      const stream = await download.createReadStream();
      if (!stream) break;
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }
      pendingProofs.push({
        type: "download",
        title: action.title,
        buffer: Buffer.concat(chunks),
      });
      break;
    }
    case "extractText": {
      const text = action.selector
        ? await page.locator(action.selector).innerText()
        : await page.locator("body").innerText();
      extractedText.push(text.trim());
      pendingProofs.push({
        type: "extracted_text",
        title: "Confirmation text",
        text: text.trim(),
      });
      break;
    }
    default:
      break;
  }

  void taskId;
}

export type BrowserTimelineHook = (
  label: string,
  metadata?: Record<string, unknown>
) => Promise<void>;

class BrowserExecutor {
  async run(
    input: BrowserRunInput,
    onTimeline?: BrowserTimelineHook
  ): Promise<BrowserRunResult> {
    enforceSafety(input);

    const runErrors: string[] = [];
    const extractedText: string[] = [];
    const pendingProofs: PendingProof[] = [];
    let finalUrl = input.startUrl;
    let tracePath: string | undefined;

    const playwrightEnabled =
      process.env.PLAYWRIGHT_ENABLED === "true" ||
      process.env.NODE_ENV === "test" ||
      process.env.PLAYWRIGHT_FORCE === "true";

    if (!playwrightEnabled) {
      return {
        success: false,
        finalUrl: input.startUrl,
        proofs: [],
        extractedText: [],
        errors: [
          "Playwright disabled — set PLAYWRIGHT_ENABLED=true to run browser automation",
        ],
      };
    }

    let browser: Awaited<
      ReturnType<(typeof import("playwright"))["chromium"]["launch"]>
    > | null = null;

    try {
      const { chromium, errors } = await import("playwright");
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);

      const enableTrace =
        process.env.BROWSER_TRACE === "true" ||
        process.env.NODE_ENV === "development";

      if (enableTrace) {
        await context.tracing.start({ screenshots: true, snapshots: true });
      }

      const pageText = await page.content();
      const risks = detectRiskSignals(pageText);
      if (risks.length > 0) {
        runErrors.push(
          `Risk signals detected (${risks.slice(0, 3).join(", ")}) — approval required`
        );
      }

      for (const action of input.actions) {
        const logAction = maskActionForLog(action);

        if (shouldBlockSubmit(action, input)) {
          runErrors.push("Final submit blocked — awaiting user approval");
          await onTimeline?.("Awaiting approval before final submit", {
            action: logAction,
          });
          break;
        }

        try {
          await executeAction(
            page,
            action,
            input.taskId,
            extractedText,
            pendingProofs
          );
          finalUrl = page.url();
          await onTimeline?.(timelineLabelForAction(action), {
            action: logAction,
            url: finalUrl,
          });
        } catch (e) {
          const { errors: pwErrors } = await import("playwright");
          if (e instanceof pwErrors.TimeoutError) {
            runErrors.push(
              `Timeout during ${action.type}${"label" in action && action.label ? `: ${action.label}` : ""}`
            );
          } else {
            runErrors.push(
              e instanceof Error ? e.message : `Failed on ${action.type}`
            );
          }
        }
      }

      if (enableTrace) {
        const { randomUUID } = await import("crypto");
        tracePath = `/tmp/resolve-trace-${input.taskId}-${randomUUID()}.zip`;
        await context.tracing.stop({ path: tracePath });
        const { readFile } = await import("fs/promises");
        try {
          const traceBuffer = await readFile(tracePath);
          pendingProofs.push({
            type: "trace",
            title: "Browser trace",
            buffer: traceBuffer,
          });
        } catch {
          /* trace optional */
        }
      }

      await context.close();
    } catch (e) {
      runErrors.push(
        e instanceof Error
          ? e.message
          : "Chromium unavailable — run npx playwright install chromium"
      );
    } finally {
      await browser?.close().catch(() => undefined);
    }

    const proofs: BrowserProof[] = [];
    for (const pending of pendingProofs) {
      const saved = await saveProofArtifact({
        taskId: input.taskId,
        type: pending.type,
        title: pending.title,
        buffer: pending.buffer,
        text: pending.text,
      });
      proofs.push(saved);
    }

    if (extractedText.length > 0) {
      await onTimeline?.("Proof hash generated", {
        hashes: proofs.map((p) => p.hash),
      });
    }

    return {
      success: runErrors.length === 0,
      finalUrl,
      proofs,
      extractedText,
      tracePath,
      errors: runErrors,
    };
  }
}

export const browserExecutor = new BrowserExecutor();
