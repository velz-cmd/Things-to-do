import type { BrowserAction, BrowserRunInput } from "@/lib/browser/browser-types";

const RISK_KEYWORDS = [
  "payment",
  "credit card",
  "bank account",
  "social security",
  "government id",
  "identity document",
  "delete account",
  "permanently remove",
  "legal agreement",
  "terms of service",
  "captcha",
  "verify you are human",
];

const FINAL_SUBMIT_SELECTORS = [
  "[data-action='final-submit']",
  "[data-testid='cancel-submit']",
  "[data-testid='claim-submit']",
  "button[type='submit']",
];

export function maskSensitiveValue(value: string): string {
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}${"*".repeat(Math.min(value.length - 4, 8))}${value.slice(-2)}`;
}

export function maskActionForLog(action: BrowserAction): BrowserAction {
  if (action.type === "fill" && action.sensitive) {
    return { ...action, value: maskSensitiveValue(action.value) };
  }
  return action;
}

export function isFinalSubmitAction(action: BrowserAction): boolean {
  if (action.type !== "click") return false;
  return FINAL_SUBMIT_SELECTORS.some((sel) => action.selector.includes(sel));
}

export function canSubmitFinalAction(input: BrowserRunInput): boolean {
  if (!input.requireApprovalBeforeSubmit) return true;
  return Boolean(input.userApprovedFinalSubmit);
}

export function shouldBlockSubmit(
  action: BrowserAction,
  input: BrowserRunInput
): boolean {
  if (!isFinalSubmitAction(action)) return false;
  return !canSubmitFinalAction(input);
}

export function detectRiskSignals(pageText: string): string[] {
  const lower = pageText.toLowerCase();
  return RISK_KEYWORDS.filter((kw) => lower.includes(kw));
}

export function enforceSafety(input: BrowserRunInput): void {
  if (!input.taskId) throw new Error("taskId is required");
  if (!input.startUrl) throw new Error("startUrl is required");
  if (!input.actions.length) throw new Error("At least one browser action is required");

  for (const action of input.actions) {
    if (action.type === "fill" && action.sensitive) {
      const v = action.value;
      if (/^\d{13,19}$/.test(v.replace(/\s/g, ""))) {
        throw new Error("Refusing to store card numbers in browser automation");
      }
      if (v.length > 64 && /password|secret|token/i.test(action.label ?? "")) {
        throw new Error("Refusing to automate secret credential fields");
      }
    }
  }
}

export function timelineLabelForAction(action: BrowserAction): string {
  switch (action.type) {
    case "goto":
      return "Portal opened";
    case "click":
      return action.label ?? "Request submitted";
    case "fill":
      return action.label ? `Form completed: ${action.label}` : "Form completed";
    case "select":
      return action.label ?? "Option selected";
    case "upload":
      return action.label ?? "Receipt uploaded";
    case "screenshot":
      return `Screenshot captured: ${action.title}`;
    case "download":
      return `Download captured: ${action.title}`;
    case "extractText":
      return "Confirmation text extracted";
    case "waitForText":
      return "Awaiting confirmation";
    case "waitForSelector":
      return "Page ready";
    default:
      return "Browser step completed";
  }
}
