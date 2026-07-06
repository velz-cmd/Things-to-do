/** Operator hint when Circle entity secret is missing or mismatched. */
export const CIRCLE_ENTITY_SECRET_SETUP_HINT =
  "Circle Entity Secret is a separate 64-character hex key (not your API Key or Client Key). " +
  "In Circle Console open Configurator → Entity Secret. " +
  "Set CIRCLE_ENTITY_SECRET on Vercel to that value (no colons). " +
  "See docs/CIRCLE-SETUP.md.";

const ENTITY_SECRET_CODES = new Set([156013, 156016, 156015]);

function isEntitySecretError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: number; message?: string; response?: { data?: { code?: number; message?: string } } };
  const code = e.code ?? e.response?.data?.code;
  if (code != null && ENTITY_SECRET_CODES.has(code)) return true;
  const msg = `${e.message ?? ""} ${e.response?.data?.message ?? ""}`.toLowerCase();
  return msg.includes("entity secret") || msg.includes("entitysecret");
}

/** Extract a human-readable message from Circle SDK / axios errors. */
export function circleErrorMessage(err: unknown): string {
  if (isEntitySecretError(err)) {
    return `Circle entity secret is missing or not registered. ${CIRCLE_ENTITY_SECRET_SETUP_HINT}`;
  }

  if (err instanceof Error && err.message && err.message !== "Error") {
    if (isEntitySecretError(err.message)) {
      return `Circle entity secret is missing or not registered. ${CIRCLE_ENTITY_SECRET_SETUP_HINT}`;
    }
    return err.message;
  }
  if (!err || typeof err !== "object") return "Circle API request failed";

  const e = err as {
    message?: string;
    code?: number;
    response?: {
      data?: {
        message?: string;
        code?: number;
        errors?: Array<{ error?: string; message?: string; location?: string }>;
      };
    };
  };

  const data = e.response?.data;
  const detail = data?.errors?.map((x) => x.message ?? x.error).filter(Boolean).join("; ");
  const base =
    detail ??
    data?.message ??
    e.message ??
    (e.code ? `Circle error ${e.code}` : "Circle API request failed");

  if (isEntitySecretError(base)) {
    return `Circle entity secret is missing or not registered. ${CIRCLE_ENTITY_SECRET_SETUP_HINT}`;
  }
  return base;
}
