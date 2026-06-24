import type { AgentRole } from "@/lib/deputy/types";
import { QWEN_MODELS } from "@/lib/ai/qwen";

export const AGENT_DEFINITIONS: Record<
  AgentRole,
  { model: string; responsibility: string; usesLlm: boolean }
> = {
  Planner: {
    model: QWEN_MODELS.plus,
    responsibility: "Parse intent → outcome checklist",
    usesLlm: true,
  },
  Evidence: {
    model: QWEN_MODELS.flash,
    responsibility: "Search inbox, find booking refs",
    usesLlm: true,
  },
  Executor: {
    model: QWEN_MODELS.flash,
    responsibility: "Draft/submit claim, send email",
    usesLlm: true,
  },
  Retry: {
    model: QWEN_MODELS.flash,
    responsibility: "Follow-up timing, escalation copy",
    usesLlm: true,
  },
  Negotiator: {
    model: QWEN_MODELS.plus,
    responsibility: "Merchant negotiation language",
    usesLlm: true,
  },
  Verification: {
    model: "deterministic",
    responsibility: "Apply PROOF_POLICIES — never trust LLM",
    usesLlm: false,
  },
  Escalation: {
    model: QWEN_MODELS.max,
    responsibility: "Human handoff package when blocked",
    usesLlm: true,
  },
};

export const TOOL_SCHEMAS = {
  "gmail.searchReceipts": {
    description: "Search user inbox for booking receipts",
    params: { query: "string" },
  },
  "gmail.findProof": {
    description: "Find cancellation or refund confirmation email",
    params: { merchantId: "string", type: "refund | cancellation" },
  },
  "resend.sendClaim": {
    description: "Send outbound compensation claim email",
    params: { to: "string", subject: "string", body: "string" },
  },
  "browser.submitClaim": {
    description: "Submit claim via merchant portal, capture screenshot proof",
    params: { portalUrl: "string", taskId: "string" },
  },
  "plaid.findRecurring": {
    description: "Detect recurring subscription charges",
    params: { merchantHint: "string" },
  },
} as const;
