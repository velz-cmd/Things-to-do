import { prisma } from "@/lib/db";
import { browserExecutor } from "@/lib/browser/browser-executor";
import { recipeForTask } from "@/lib/browser/browser-recipes";
import {
  attachBrowserProofToTask,
  hashContent,
} from "@/lib/browser/browser-proof";
import type { BrowserRunResult } from "@/lib/browser/browser-types";

async function logBrowserEvent(
  taskId: string,
  message: string,
  metadata?: Record<string, unknown>
) {
  await prisma.taskEvent.create({
    data: {
      taskId,
      agent: "Executor",
      phase: "browser",
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });
}

function parseConfirmationId(extracted: string[]): string | undefined {
  for (const block of extracted) {
    const match = block.match(/(?:CONF|TKT|SUB)-[A-Z0-9-]+/i);
    if (match) return match[0].toUpperCase();
  }
  return undefined;
}

export async function runBrowserWorkflowForTask(
  taskId: string,
  options?: { userApprovedFinalSubmit?: boolean }
): Promise<BrowserRunResult | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { user: true },
  });
  if (!task) throw new Error("Task not found");

  const email =
    task.user?.email ?? `resolve+${taskId.slice(0, 8)}@demo.resolve.app`;

  const recipe = recipeForTask({
    taskId,
    category: task.category,
    merchantId: task.merchantId,
    email,
    targetValueUsd: task.targetValueUsd,
    userApprovedFinalSubmit: options?.userApprovedFinalSubmit ?? true,
  });

  if (!recipe) return null;

  await logBrowserEvent(taskId, "Portal opened", { purpose: recipe.purpose });

  const result = await browserExecutor.run(recipe, async (label, metadata) => {
    await logBrowserEvent(taskId, label, metadata);
  });

  if (result.proofs.length > 0) {
    const primary =
      result.proofs.find((p) => p.type === "extracted_text") ??
      result.proofs[result.proofs.length - 1];
    const confirmationId =
      parseConfirmationId(result.extractedText) ??
      `BR-${taskId.slice(0, 6).toUpperCase()}`;

    await attachBrowserProofToTask({
      taskId,
      proof: primary,
      confirmationId,
    });

    await logBrowserEvent(taskId, "Confirmation captured", {
      confirmationId,
      proofHash: primary.hash,
    });

    if (result.success) {
      await logBrowserEvent(taskId, "Proof verified", {
        contentHash: hashContent(result.extractedText.join("\n") || primary.hash),
      });
    }
  }

  if (result.errors.length > 0) {
    await logBrowserEvent(
      taskId,
      "Browser automation needs assistance",
      { errors: result.errors }
    );
  }

  return result;
}
