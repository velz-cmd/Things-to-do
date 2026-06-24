import type { AgentRole } from "@/lib/deputy/types";
import { AI_MODELS } from "@/lib/ai/gateway";

export const AGENT_DEFINITIONS: Record<
  AgentRole,
  { model: string; tier: string; responsibility: string; usesLlm: boolean }
> = {
  Planner: {
    model: AI_MODELS.gemini.quality,
    tier: "quality",
    responsibility: "Parse intent → outcome checklist",
    usesLlm: true,
  },
  Evidence: {
    model: AI_MODELS.groq.fast,
    tier: "fast",
    responsibility: "Search inbox, find booking refs",
    usesLlm: true,
  },
  Executor: {
    model: AI_MODELS.groq.fast,
    tier: "fast",
    responsibility: "Draft/submit claim, send email",
    usesLlm: true,
  },
  Retry: {
    model: AI_MODELS.groq.fast,
    tier: "fast",
    responsibility: "Follow-up timing, escalation copy",
    usesLlm: true,
  },
  Negotiator: {
    model: AI_MODELS.gemini.quality,
    tier: "quality",
    responsibility: "Merchant negotiation language",
    usesLlm: true,
  },
  Verification: {
    model: "deterministic",
    tier: "none",
    responsibility: "Apply PROOF_POLICIES — never trust LLM",
    usesLlm: false,
  },
  Escalation: {
    model: AI_MODELS.openrouter.research,
    tier: "research",
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
