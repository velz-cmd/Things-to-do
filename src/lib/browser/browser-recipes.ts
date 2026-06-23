import type { BrowserRunInput } from "@/lib/browser/browser-types";
import { getAppBaseUrl } from "@/lib/browser/app-url";

export function streamlyCancellationRecipe(input: {
  taskId: string;
  email: string;
  userApprovedFinalSubmit?: boolean;
}): BrowserRunInput {
  const base = getAppBaseUrl();
  return {
    taskId: input.taskId,
    purpose: "subscription_cancellation",
    startUrl: `${base}/demo-portals/streamly`,
    requireApprovalBeforeSubmit: true,
    userApprovedFinalSubmit: input.userApprovedFinalSubmit ?? true,
    actions: [
      { type: "goto", url: `${base}/demo-portals/streamly` },
      { type: "screenshot", title: "Account page" },
      {
        type: "fill",
        selector: '[data-testid="account-email"]',
        value: input.email,
        label: "Email",
        sensitive: true,
      },
      {
        type: "click",
        selector: '[data-testid="cancel-start"]',
        label: "Open cancellation portal",
      },
      {
        type: "waitForSelector",
        selector: '[data-testid="cancel-form"]',
      },
      {
        type: "fill",
        selector: '[data-testid="cancel-reason"]',
        value: "No longer using the service",
        label: "Cancellation reason",
      },
      { type: "screenshot", title: "Before submission" },
      {
        type: "click",
        selector: '[data-testid="cancel-submit"]',
        label: "Submit cancellation",
      },
      {
        type: "waitForText",
        text: "Subscription cancelled",
        timeoutMs: 20000,
      },
      { type: "screenshot", title: "Cancellation confirmation" },
      { type: "extractText", selector: '[data-proof="confirmation"]' },
    ],
  };
}

export function airlineClaimRecipe(input: {
  taskId: string;
  email: string;
  claimAmount: string;
  userApprovedFinalSubmit?: boolean;
}): BrowserRunInput {
  const base = getAppBaseUrl();
  return {
    taskId: input.taskId,
    purpose: "airline_compensation",
    startUrl: `${base}/demo-portals/streamly`,
    requireApprovalBeforeSubmit: true,
    userApprovedFinalSubmit: input.userApprovedFinalSubmit ?? true,
    actions: [
      { type: "goto", url: `${base}/demo-portals/streamly?mode=claim` },
      { type: "screenshot", title: "Claim portal" },
      {
        type: "fill",
        selector: '[data-testid="account-email"]',
        value: input.email,
        label: "Email",
        sensitive: true,
      },
      {
        type: "fill",
        selector: '[data-testid="claim-amount"]',
        value: input.claimAmount,
        label: "Refund amount",
      },
      { type: "screenshot", title: "Before claim submission" },
      {
        type: "click",
        selector: '[data-testid="claim-submit"]',
        label: "Submit claim",
      },
      {
        type: "waitForText",
        text: "Claim submitted",
        timeoutMs: 20000,
      },
      { type: "screenshot", title: "Claim confirmation" },
      { type: "extractText", selector: '[data-proof="confirmation"]' },
    ],
  };
}

export function recipeForTask(input: {
  taskId: string;
  category: string;
  merchantId: string | null;
  email: string;
  targetValueUsd: number;
  userApprovedFinalSubmit?: boolean;
}): BrowserRunInput | null {
  if (
    input.category === "subscription" ||
    input.merchantId === "streamdemo" ||
    input.merchantId === "streamly"
  ) {
    return streamlyCancellationRecipe({
      taskId: input.taskId,
      email: input.email,
      userApprovedFinalSubmit: input.userApprovedFinalSubmit,
    });
  }

  if (input.category === "money_recovery") {
    return airlineClaimRecipe({
      taskId: input.taskId,
      email: input.email,
      claimAmount: input.targetValueUsd.toFixed(2),
      userApprovedFinalSubmit: input.userApprovedFinalSubmit,
    });
  }

  return null;
}
