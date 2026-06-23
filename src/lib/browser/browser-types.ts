export type BrowserPurpose =
  | "subscription_cancellation"
  | "refund_claim"
  | "airline_compensation"
  | "parcel_claim"
  | "proof_capture"
  | "demo_verification";

export type BrowserAction =
  | { type: "goto"; url: string }
  | { type: "click"; selector: string; label?: string }
  | {
      type: "fill";
      selector: string;
      value: string;
      label?: string;
      sensitive?: boolean;
    }
  | { type: "select"; selector: string; value: string; label?: string }
  | { type: "upload"; selector: string; filePath: string; label?: string }
  | { type: "waitForText"; text: string; timeoutMs?: number }
  | { type: "waitForSelector"; selector: string; timeoutMs?: number }
  | { type: "screenshot"; title: string }
  | { type: "download"; title: string }
  | { type: "extractText"; selector?: string };

export type BrowserRunInput = {
  taskId: string;
  purpose: BrowserPurpose;
  startUrl: string;
  actions: BrowserAction[];
  requireApprovalBeforeSubmit: boolean;
  userApprovedFinalSubmit?: boolean;
};

export type BrowserProofType =
  | "screenshot"
  | "download"
  | "extracted_text"
  | "trace";

export type BrowserProof = {
  id: string;
  taskId: string;
  type: BrowserProofType;
  title: string;
  path?: string;
  text?: string;
  hash: string;
  createdAt: string;
};

export type BrowserRunResult = {
  success: boolean;
  finalUrl: string;
  proofs: BrowserProof[];
  extractedText: string[];
  tracePath?: string;
  errors: string[];
};

export type BrowserApiResponse = {
  ok: boolean;
  result: BrowserRunResult;
  message?: string;
  error?: string;
};
